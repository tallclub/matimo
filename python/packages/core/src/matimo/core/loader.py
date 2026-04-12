"""
YAML / JSON tool loader.
Mirrors: packages/core/src/core/tool-loader.ts (ToolLoader class)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from matimo.core.models import ProviderDefinition, ToolDefinition
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")

# Filenames recognised as tool definitions
_TOOL_FILENAMES = {"definition.yaml", "definition.yml", "definition.json", "tool.yaml"}


class ToolLoader:
    """
    Loads and validates tool definitions from YAML/JSON files.
    Mirrors: ToolLoader in tool-loader.ts
    """

    _discovered_cache: list[str] | None = None

    # ------------------------------------------------------------------
    # Single-file loading
    # ------------------------------------------------------------------

    def load_tool_from_file(self, file_path: str | Path) -> ToolDefinition:
        """
        Read one YAML/JSON file, validate with Pydantic, set _definition_path.
        Raises MatimoError(INVALID_SCHEMA) on parse or validation failure.
        """
        path = Path(file_path)
        if not path.exists():
            raise MatimoError(
                f"Tool definition file not found: {path}",
                ErrorCode.FILE_NOT_FOUND,
                {"path": str(path)},
            )

        try:
            raw = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise MatimoError(
                f"Cannot read tool definition: {path}",
                ErrorCode.FILE_NOT_FOUND,
                {"path": str(path)},
                cause=exc,
            ) from exc

        try:
            data: Any = (
                json.loads(raw)
                if path.suffix == ".json"
                else yaml.safe_load(raw)
            )
        except (json.JSONDecodeError, yaml.YAMLError) as exc:
            raise MatimoError(
                f"Failed to parse tool definition: {path}\n{exc}",
                ErrorCode.INVALID_SCHEMA,
                {"path": str(path)},
                cause=exc,
            ) from exc

        # Skip non-tool YAML files such as provider definition.yaml
        if isinstance(data, dict) and data.get("type") == "provider":
            raise MatimoError(
                f"Skipping provider definition (not a tool): {path}",
                ErrorCode.INVALID_SCHEMA,
                {"path": str(path), "reason": "provider_definition"},
            )

        try:
            tool = ToolDefinition.model_validate(data)
        except ValidationError as exc:
            raise MatimoError(
                f"Tool schema validation failed: {path}\n{exc}",
                ErrorCode.INVALID_SCHEMA,
                {"path": str(path), "issues": exc.errors()},
                cause=exc,
            ) from exc

        tool.set_definition_path(str(path))
        return tool

    # ------------------------------------------------------------------
    # Directory loading
    # ------------------------------------------------------------------

    def load_tools_from_directory(self, dir_path: str | Path) -> dict[str, ToolDefinition]:
        """
        Recursively find definition files under dir_path and load each.
        Files that fail validation are logged and skipped (provider YAML etc.).
        Returns {tool_name: ToolDefinition}.
        """
        root = Path(dir_path)
        if not root.exists():
            logger.warning("Tool directory does not exist: %s", root)
            return {}

        tools: dict[str, ToolDefinition] = {}

        for candidate in root.rglob("*"):
            if candidate.name not in _TOOL_FILENAMES:
                continue
            try:
                tool = self.load_tool_from_file(candidate)
                tools[tool.name] = tool
                logger.debug("Loaded tool '%s' from %s", tool.name, candidate)
            except MatimoError as exc:
                # Provider definitions and schema errors are expected here
                if exc.details.get("reason") != "provider_definition":
                    logger.debug(
                        "Skipping %s — %s: %s", candidate, exc.code.value, exc
                    )

        return tools

    def load_tools_from_multiple_paths(
        self, paths: list[str | Path]
    ) -> dict[str, ToolDefinition]:
        """
        Load tools from multiple directories.
        Later paths override earlier definitions with the same name.
        """
        all_tools: dict[str, ToolDefinition] = {}
        for path in paths:
            all_tools.update(self.load_tools_from_directory(path))
        return all_tools

    # ------------------------------------------------------------------
    # Auto-discovery (pip entry points + workspace scan)
    # ------------------------------------------------------------------

    def auto_discover_packages(self) -> list[str]:
        """
        Discover tool directories from:
        1. Installed matimo-* pip packages (via entry_points 'matimo.providers')
        2. Workspace scan: packages/*/tools/ relative to the loader's cwd

        Result is cached after first call.
        """
        if ToolLoader._discovered_cache is not None:
            return ToolLoader._discovered_cache

        paths: list[str] = []

        # 1. Entry points from installed packages
        try:
            from importlib.metadata import entry_points

            eps = entry_points(group="matimo.providers")
            for ep in eps:
                try:
                    get_tools_path = ep.load()
                    tool_path = get_tools_path()
                    if Path(tool_path).exists():
                        paths.append(str(tool_path))
                        logger.debug(
                            "Auto-discovered provider '%s' at %s", ep.name, tool_path
                        )
                except Exception as exc:
                    logger.debug("Failed to load provider entry point '%s': %s", ep.name, exc)
        except Exception as exc:
            logger.debug("Entry point discovery failed: %s", exc)

        # 2. Workspace scan — look for packages/*/tools/ from cwd upwards
        cwd = Path.cwd()
        for search_root in [cwd, *cwd.parents]:
            pkg_tools = search_root / "packages"
            if pkg_tools.exists():
                for provider_dir in pkg_tools.iterdir():
                    tools_dir = provider_dir / "tools"
                    if tools_dir.exists() and str(tools_dir) not in paths:
                        paths.append(str(tools_dir))
                        logger.debug("Auto-discovered workspace tools at %s", tools_dir)
                break  # stop at first matching ancestor

        ToolLoader._discovered_cache = paths
        return paths

    @classmethod
    def clear_discovery_cache(cls) -> None:
        """Clear the auto-discovery cache (useful in tests)."""
        cls._discovered_cache = None

    # ------------------------------------------------------------------
    # Provider definition loading (for OAuth2 providers)
    # ------------------------------------------------------------------

    def load_provider_definition(
        self, file_path: str | Path
    ) -> ProviderDefinition:
        """Load and validate a provider definition.yaml (OAuth2 provider config)."""
        path = Path(file_path)
        raw = path.read_text(encoding="utf-8")
        data: Any = yaml.safe_load(raw)

        try:
            return ProviderDefinition.model_validate(data)
        except ValidationError as exc:
            raise MatimoError(
                f"Provider schema validation failed: {path}\n{exc}",
                ErrorCode.INVALID_SCHEMA,
                {"path": str(path), "issues": exc.errors()},
                cause=exc,
            ) from exc
