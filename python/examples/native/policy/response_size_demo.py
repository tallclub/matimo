#!/usr/bin/env python3
"""
============================================================================
RESPONSE SIZE GUARDRAIL — keep huge tool results out of the model's context
============================================================================

Every result is measured as serialized UTF-8 JSON. Over the limit, lists and
strings are cut down in place with an inline "...truncated" marker, and a
top-level dict gains `_truncated: True`, so the model knows it saw only part
of the data.

The limit, most specific first:
  output_schema.max_response_size   in the tool's YAML
  default_max_response_size         in Matimo.init()
  DEFAULT_MAX_RESPONSE_SIZE_BYTES   built in

A Python HTTP tool returns the parsed response body itself (here a list of
posts); the TypeScript SDK wraps it as {success, data, statusCode, headers}.

No API keys needed. Calls the public JSONPlaceholder test API, whose /posts
endpoint returns 100 posts (about 27 KB). Mirrors response-size-demo.ts.

USAGE:
  uv run python native/policy/response_size_demo.py
============================================================================
"""

from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from pathlib import Path

from matimo import Matimo


def tool_yaml(name: str, extra: str = "") -> str:
    return f"""name: {name}
version: '1.0.0'
description: List every post
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts'
{extra}"""


async def main() -> None:
    tools_dir = Path(tempfile.mkdtemp(prefix="matimo-size-"))
    for name, extra in [
        ("list_posts", ""),
        (
            "list_posts_small",
            "output_schema:\n  type: object\n  max_response_size: 3000\n",
        ),
    ]:
        (tools_dir / name).mkdir()
        (tools_dir / name / "definition.yaml").write_text(tool_yaml(name, extra))

    try:
        matimo = await Matimo.init(
            str(tools_dir),
            log_level="silent",
            default_max_response_size=6000,  # for tools that don't set their own
        )
        for name in ("list_posts", "list_posts_small"):
            posts = await matimo.execute(name, {})
            kept = [item for item in posts if isinstance(item, dict)]
            print(f"\n{name}")
            print(f"   size: {len(json.dumps(posts).encode())} bytes")
            print(f"   posts kept: {len(kept)}")
            print(f"   marker: {posts[-1]!r}")
        print()
    finally:
        shutil.rmtree(tools_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
