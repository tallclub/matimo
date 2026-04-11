"""matimo_reload_tools — hot-reload tool registry from configured paths.

NOTE: Actual reload is intercepted by Matimo.execute() which calls instance.reload().
This fallback is only reached in environments without the interception.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("matimo")


async def run(params: dict) -> dict:  # noqa: ARG001  # type: ignore[type-arg]
    # Try to call reload on the global instance
    try:
        from matimo.decorators import get_global_matimo_instance

        instance = get_global_matimo_instance()
        if instance is not None:
            await instance.reload()
            tools = instance.list_tools()
            return {
                "success": True,
                "loaded": len(tools),
                "removed": 0,
                "revalidated": 0,
                "rejected": [],
                "message": f"Reloaded {len(tools)} tools successfully.",
            }
    except Exception as exc:
        logger.debug("matimo_reload_tools fallback: %s", exc)

    return {
        "success": False,
        "loaded": 0,
        "removed": 0,
        "revalidated": 0,
        "rejected": [],
        "message": "Reload must be handled by Matimo instance. Initialize Matimo and call matimo.reload() directly.",
    }
