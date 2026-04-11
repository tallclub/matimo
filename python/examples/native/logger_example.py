#!/usr/bin/env python3
"""
============================================================================
LOGGER EXAMPLE -- Matimo Structured Logging
============================================================================

Demonstrates how to use Matimo's logging system for production observability.
The logger wraps Python stdlib logging and mirrors the TypeScript MatimoLogger
interface.

Log levels (silent | error | warn | info | debug):
  silent  -- no output (useful in tests)
  error   -- only errors
  warn    -- errors + warnings
  info    -- standard operational messages (default)
  debug   -- verbose, all messages

Log formats:
  simple  -- human-readable text (dev / local use)
  json    -- structured JSON per line  (prod / log aggregators)

Two ways to get a logger:
  1. Standalone:  setup_logger(level='debug', log_format='json')
  2. From SDK:    matimo._logger  (same MatimoLogger used internally by Matimo)

USAGE:
--------------------------------------------------------------------
  uv run python logger_example.py

============================================================================
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from matimo import Matimo  # noqa: E402
from matimo.logging import (  # noqa: E402
    MatimoLogger,
    get_global_matimo_logger,
    set_global_matimo_logger,
    setup_logger,
)


async def main() -> None:
    print("\n" + "=" * 60)
    print("  Matimo Logger Example")
    print("=" * 60)

    # ── 1. Standalone logger (simple format) ────────────────────────────────

    print("\n-- 1. Standalone logger (simple text format) --\n")

    simple_logger = setup_logger(level="debug", log_format="simple")
    simple_logger.info("Matimo logger initialized", version="1.0.0", env="development")
    simple_logger.debug("Debug info for development", tool_count=5, source="standalone")
    simple_logger.warn(
        "Missing optional parameter", param="message_blocks", using_fallback=True
    )
    simple_logger.error(
        "Simulated error (not real)", code="DEMO_ERROR", retryable=False
    )

    # ── 2. Standalone logger (JSON format) ──────────────────────────────────

    print("\n-- 2. Standalone logger (JSON format -- prod ready) --\n")

    json_logger = setup_logger(level="info", log_format="json")
    json_logger.info("User action initiated", user_id="user_123", action="list_tools")
    json_logger.info(
        "Tool executed successfully",
        tool_name="slack_send_message",
        duration_ms=143,
        status="ok",
    )
    json_logger.warn(
        "Rate limit approaching",
        provider="slack",
        rate_limit_remaining=12,
        reset_in_seconds=45,
    )

    # ── 3. Global logger singleton ───────────────────────────────────────────

    print("\n-- 3. Global logger singleton --\n")

    global_logger: MatimoLogger = get_global_matimo_logger()
    global_logger.info("Using the global logger singleton")

    # Replace the global logger with a custom one
    custom_logger = setup_logger(level="debug", log_format="simple")
    set_global_matimo_logger(custom_logger)

    updated = get_global_matimo_logger()
    updated.debug("Global logger replaced with custom instance")

    # ── 4. SDK logger (from Matimo instance) ─────────────────────────────────

    print("\n-- 4. Matimo SDK logger (log_level='debug', log_format='simple') --\n")

    matimo = await Matimo.init(auto_discover=True, log_level="debug", log_format="simple")

    # Access the internal logger used by the Matimo SDK itself.
    # Note: _logger is a private attribute — for demos and custom integrations only.
    sdk_logger: MatimoLogger = matimo._logger

    tools = matimo.list_tools()
    sdk_logger.info("Matimo ready", tool_count=len(tools))
    sdk_logger.debug("Tool list sample", tools=[t.name for t in tools[:5]])
    sdk_logger.warn("Example warning from SDK logger", param="optional_field", fallback=True)

    # ── 5. Log level filtering ───────────────────────────────────────────────

    print("\n-- 5. Log level filtering (level='warn' suppresses info+debug) --\n")

    warn_logger = setup_logger(level="warn", log_format="simple")
    warn_logger.debug("This debug message is suppressed (level=warn)")
    warn_logger.info("This info message is suppressed (level=warn)")
    warn_logger.warn("This warning is visible")  # only this + error appear
    warn_logger.error("This error is visible")

    # ── 6. Silent logger (useful in tests) ──────────────────────────────────

    print("\n-- 6. Silent logger (no output -- useful in tests) --\n")

    silent_logger = setup_logger(level="silent", log_format="simple")
    silent_logger.debug("Suppressed")
    silent_logger.info("Suppressed")
    silent_logger.warn("Suppressed")
    silent_logger.error("Suppressed")
    print("  (no log lines above -- silent logger active)")

    # ── Done ─────────────────────────────────────────────────────────────────

    print("\n" + "=" * 60)
    print("  Logger Examples Complete")
    print("  Key APIs:")
    print("    setup_logger(level, log_format)  -> MatimoLogger")
    print("    get_global_matimo_logger()        -> MatimoLogger")
    print("    set_global_matimo_logger(logger)  -> None")
    print("    Matimo._logger                    -> MatimoLogger (SDK internal)")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
