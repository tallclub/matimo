"""
In-memory tool registry.
Mirrors: packages/core/src/core/tool-registry.ts (ToolRegistry class)
"""
from __future__ import annotations

import logging
from collections.abc import Iterator

from matimo.core.models import ToolDefinition
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")


class ToolRegistry:
    """
    Thread-safe in-memory store of ToolDefinition objects.
    Mirrors: ToolRegistry in tool-registry.ts
    """

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        self._tags_index: dict[str, list[str]] = {}  # tag → [tool_name, ...]

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, tool: ToolDefinition) -> None:
        """
        Register a single tool. Raises MatimoError(INVALID_SCHEMA) on duplicate
        unless the existing entry has the same name (treated as idempotent reload).
        """
        if tool.name in self._tools:
            raise MatimoError(
                f"Tool '{tool.name}' is already registered",
                ErrorCode.INVALID_SCHEMA,
                {"tool_name": tool.name},
            )
        self._tools[tool.name] = tool
        self._index_tags(tool)
        logger.debug("Registered tool '%s'", tool.name)

    def register_or_replace(self, tool: ToolDefinition) -> None:
        """
        Register a tool, replacing any existing registration with the same name.
        Used during hot-reload.
        """
        if tool.name in self._tools:
            self._remove_tag_index(tool.name)
        self._tools[tool.name] = tool
        self._index_tags(tool)

    def register_all(self, tools: list[ToolDefinition]) -> None:
        """Register a list of tools."""
        for tool in tools:
            self.register(tool)

    def register_all_replace(self, tools: list[ToolDefinition]) -> None:
        """Register a list of tools, replacing duplicates (hot-reload)."""
        for tool in tools:
            self.register_or_replace(tool)

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def get(self, name: str) -> ToolDefinition | None:
        """Return tool by exact name, or None if not found."""
        return self._tools.get(name)

    def get_or_raise(self, name: str) -> ToolDefinition:
        """Return tool by name or raise MatimoError(TOOL_NOT_FOUND)."""
        tool = self._tools.get(name)
        if tool is None:
            raise MatimoError(
                f"Tool '{name}' not found",
                ErrorCode.TOOL_NOT_FOUND,
                {"tool_name": name, "available": list(self._tools.keys())},
            )
        return tool

    def has(self, name: str) -> bool:
        """Check whether a tool is registered."""
        return name in self._tools

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get_all(self) -> list[ToolDefinition]:
        """Return all registered tools."""
        return list(self._tools.values())

    def get_by_tag(self, tag: str) -> list[ToolDefinition]:
        """Return tools that carry the given tag."""
        names = self._tags_index.get(tag, [])
        return [self._tools[n] for n in names if n in self._tools]

    def search(self, query: str) -> list[ToolDefinition]:
        """
        Case-insensitive substring search over tool name and description.
        Returns tools whose name OR description contains the query string.
        """
        q = query.lower()
        return [
            t for t in self._tools.values()
            if q in t.name.lower() or q in t.description.lower()
        ]

    def count(self) -> int:
        """Return the number of registered tools."""
        return len(self._tools)

    def clear(self) -> None:
        """Remove all registered tools and reset indexes."""
        self._tools.clear()
        self._tags_index.clear()

    def remove(self, name: str) -> bool:
        """
        Remove a tool by name. Returns True if the tool existed, False otherwise.
        """
        if name not in self._tools:
            return False
        self._remove_tag_index(name)
        del self._tools[name]
        logger.debug("Removed tool '%s' from registry", name)
        return True

    # ------------------------------------------------------------------
    # Iteration
    # ------------------------------------------------------------------

    def __iter__(self) -> Iterator[ToolDefinition]:
        return iter(self._tools.values())

    def __len__(self) -> int:
        return len(self._tools)

    def __contains__(self, name: str) -> bool:
        return name in self._tools

    # ------------------------------------------------------------------
    # Internal tag indexing
    # ------------------------------------------------------------------

    def _index_tags(self, tool: ToolDefinition) -> None:
        for tag in tool.tags or []:
            self._tags_index.setdefault(tag, []).append(tool.name)

    def _remove_tag_index(self, name: str) -> None:
        tool = self._tools.get(name)
        if tool is None:
            return
        for tag in tool.tags or []:
            entries = self._tags_index.get(tag, [])
            if name in entries:
                entries.remove(name)
