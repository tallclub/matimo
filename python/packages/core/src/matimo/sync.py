"""
MatimoSync — synchronous wrapper around the async Matimo instance.

Designed for Django, Flask, scripting, and other sync-native Python environments
where async/await is inconvenient.

Usage::

    from matimo import MatimoSync

    m = MatimoSync.init('./tools')
    result = m.execute('slack_send_channel_message', {'channel': '#general', 'text': 'Hi'})
    tools = m.list_tools()

CrewAI / sync agent frameworks::

    from matimo import MatimoSync
    from matimo.integrations.crewai import convert_tools_to_crewai

    m = MatimoSync.init(auto_discover=True)
    crew_tools = convert_tools_to_crewai(m.list_tools(), m.async_instance)

Notes
-----
Each ``execute()`` call runs in its own ``asyncio.run()`` event loop.
The ``Matimo`` instance itself holds no persistent async state (no long-lived
connection pool), so this is safe.  If you need connection reuse inside a
single long-running process, use the async ``Matimo`` class directly.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from matimo.core.models import ToolDefinition
    from matimo.instance import Matimo


class MatimoSync:
    """
    Synchronous wrapper around :class:`~matimo.instance.Matimo`.

    All public methods mirror the async Matimo API but block until completion,
    making the SDK usable in sync contexts without manual event-loop management.
    """

    def __init__(self, instance: Matimo) -> None:
        self._instance = instance

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def init(
        cls,
        *args: Any,  # noqa: ANN401 — mirrors Matimo.init(*args) signature
        **kwargs: Any,  # noqa: ANN401
    ) -> MatimoSync:
        """
        Synchronous factory — mirrors ``await Matimo.init()``.

        Accepts identical arguments to :meth:`~matimo.instance.Matimo.init`.

        Example::

            m = MatimoSync.init('./tools')
            m = MatimoSync.init(auto_discover=True)
        """
        from matimo.instance import Matimo

        instance: Matimo = asyncio.run(Matimo.init(*args, **kwargs))
        return cls(instance)

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def execute(
        self,
        tool_name: str,
        params: dict[str, Any] | None = None,
        **kwargs: Any,  # noqa: ANN401 — pass-through for credentials= etc.
    ) -> Any:  # noqa: ANN401 — tool results are arbitrary JSON values
        """
        Execute a tool synchronously.

        Example::

            result = m.execute('slack_send_channel_message',
                               {'channel': '#general', 'text': 'Hi'})
        """
        return asyncio.run(
            self._instance.execute(tool_name, params or {}, **kwargs)
        )

    def list_tools(self) -> list[ToolDefinition]:
        """Return all loaded tool definitions."""
        return self._instance.list_tools()

    def search_tools(self, query: str) -> list[ToolDefinition]:
        """Search tools by name or description."""
        return self._instance.search_tools(query)

    def reload(self) -> Any:  # noqa: ANN401 — ReloadResult but avoids circular import
        """Hot-reload tool definitions from disk."""
        return asyncio.run(self._instance.reload())

    # ------------------------------------------------------------------
    # Escape hatch — access the underlying async instance
    # ------------------------------------------------------------------

    @property
    def async_instance(self) -> Matimo:
        """
        The underlying async :class:`~matimo.instance.Matimo` instance.

        Use this when you need to pass the instance to integrations that
        require the async object (e.g. ``convert_tools_to_crewai``).
        """
        return self._instance
