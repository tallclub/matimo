"""
@tool decorator — auto-executes a method via Matimo.
Mirrors: packages/core/src/decorators/tool-decorator.ts

Usage:
    set_global_matimo_instance(matimo)

    class MyAgent:
        @tool('calculator')
        async def calculate(self, operation: str, a: float, b: float):
            pass  # body is ignored — Matimo executes the named tool instead
"""
from __future__ import annotations

import asyncio
import functools
import inspect
import logging
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from matimo.instance import Matimo

logger = logging.getLogger("matimo")

_global_instance: "Matimo | None" = None


def set_global_matimo_instance(instance: "Matimo") -> None:
    """Set the global Matimo instance used by the @tool decorator."""
    global _global_instance
    _global_instance = instance


def get_global_matimo_instance() -> "Matimo | None":
    """Return the current global Matimo instance."""
    return _global_instance


def tool(tool_name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Method decorator that intercepts calls and executes the named Matimo tool.

    The decorated method's signature is used to extract parameter names.
    The method body is ignored — Matimo dispatches the call instead.

    Example:
        @tool('slack_send_channel_message')
        async def send(self, channel: str, text: str): ...

    On invocation send(channel='#general', text='Hi') →
        matimo.execute('slack_send_channel_message', {'channel': '#general', 'text': 'Hi'})
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(fn)
        async def async_wrapper(self: Any, *args: Any, **kwargs: Any) -> Any:
            instance = _resolve_instance(self)
            params = _build_params(fn, args, kwargs)
            return await instance.execute(tool_name, params)

        @functools.wraps(fn)
        def sync_wrapper(self: Any, *args: Any, **kwargs: Any) -> Any:
            instance = _resolve_instance(self)
            params = _build_params(fn, args, kwargs)
            # Run async execute synchronously
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        asyncio.run, instance.execute(tool_name, params)
                    )
                    return future.result()
            return loop.run_until_complete(instance.execute(tool_name, params))

        if inspect.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper

    return decorator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_instance(self: Any) -> "Matimo":
    """
    Resolve the Matimo instance from the object's matimo attribute or the global.
    """
    instance = getattr(self, "_matimo", None) or _global_instance
    if instance is None:
        from matimo.errors import ErrorCode, MatimoError
        raise MatimoError(
            "No Matimo instance available. "
            "Call set_global_matimo_instance(matimo) before using @tool.",
            ErrorCode.TOOL_NOT_FOUND,
        )
    return instance


def _build_params(fn: Callable[..., Any], args: tuple, kwargs: dict) -> dict[str, Any]:
    """
    Map positional and keyword arguments to a parameter dict,
    using the function's signature (excluding 'self').
    """
    sig = inspect.signature(fn)
    param_names = [
        name for name, p in sig.parameters.items()
        if name != "self" and p.kind not in (
            inspect.Parameter.VAR_POSITIONAL,
            inspect.Parameter.VAR_KEYWORD,
        )
    ]

    params: dict[str, Any] = {}
    for i, value in enumerate(args):
        if i < len(param_names):
            params[param_names[i]] = value
    params.update(kwargs)
    return params
