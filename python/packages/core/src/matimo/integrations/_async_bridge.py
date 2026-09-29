"""
Event-loop bridge for sync-calling agent frameworks.
Internal module. Not part of the public API.

Some frameworks (Agno's `agent.run()` / `print_response()`, CrewAI's
`BaseTool._run`) call tools synchronously, but `Matimo.execute()` is a
coroutine. This module runs a coroutine to completion from sync code whether
or not an event loop is already running on the calling thread.

`MatimoSync` cannot be used for this: every one of its methods calls
`asyncio.run()` internally, which raises when a loop is already running.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
from typing import TYPE_CHECKING, Any, TypeVar

if TYPE_CHECKING:
    from collections.abc import Coroutine

T = TypeVar("T")

# Single worker: offloaded coroutines run one at a time in their own loop, which
# keeps ordering deterministic and avoids spawning a thread per tool call.
_THREAD_EXECUTOR: concurrent.futures.ThreadPoolExecutor | None = None


def _get_executor() -> concurrent.futures.ThreadPoolExecutor:
    """Get or lazily create the shared single-worker thread pool."""
    global _THREAD_EXECUTOR  # noqa: PLW0603
    if _THREAD_EXECUTOR is None:
        _THREAD_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
            max_workers=1,
            thread_name_prefix="matimo-async-bridge",
        )
    return _THREAD_EXECUTOR


def run_coroutine_sync(coro: Coroutine[Any, Any, T]) -> T:
    """
    Run `coro` to completion from synchronous code and return its result.

    Two cases:

    * **No loop running on this thread**: drive the coroutine directly with
      `asyncio.run()`.
    * **A loop is already running** (Jupyter, an async web handler, or a
      framework's own async path calling a sync tool): hand the coroutine to a
      worker thread with its own loop and block on the result. Blocking the
      calling thread is unavoidable here because the caller's contract is
      synchronous, but the caller's loop itself is never blocked.

    Exceptions raised inside the coroutine propagate to the caller unchanged,
    so a `MatimoError` from the policy engine surfaces normally.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop on this thread. This is the simple, common path.
        return asyncio.run(coro)

    future = _get_executor().submit(asyncio.run, coro)
    return future.result()
