"""
OAuth2ProviderLoader — Loads provider definitions from YAML files.

Mirrors: packages/core/src/auth/oauth2-provider-loader.ts

Design Principle:
  - Configuration-driven: all provider config lives in YAML files
  - Discoverable: auto-finds tools/[provider]/definition.yaml with type=provider
  - Extensible: add a YAML file → new provider works, no code changes
  - Overridable: users can override via env vars or runtime config
"""
from __future__ import annotations

import logging
from pathlib import Path

import yaml

from matimo.core.models import OAuth2Endpoints, ProviderDefinition
from matimo.errors import ErrorCode, MatimoError

logger = logging.getLogger("matimo")


class OAuth2ProviderLoader:
    """
    Loads OAuth2 provider configurations from YAML definitions.

    Usage::

        loader = OAuth2ProviderLoader("./tools")
        await loader.load_providers()
        endpoints = loader.get_provider("google")
    """

    def __init__(self, tools_path: str) -> None:
        self._tools_path = Path(tools_path)
        self._providers: dict[str, OAuth2Endpoints] = {}
        self._definitions: dict[str, ProviderDefinition] = {}

    async def load_providers(self) -> dict[str, OAuth2Endpoints]:
        """
        Discover and load all provider definitions.

        Scans ``tools_path`` for sub-directories containing a
        ``definition.yaml`` with ``type: provider``.
        """
        try:
            if not self._tools_path.is_dir():
                return self._providers

            for entry in self._tools_path.iterdir():
                if not entry.is_dir():
                    continue

                definition_path = entry / "definition.yaml"
                if not definition_path.is_file():
                    continue

                try:
                    raw = yaml.safe_load(definition_path.read_text(encoding="utf-8"))
                    if not isinstance(raw, dict) or raw.get("type") != "provider":
                        continue

                    definition = ProviderDefinition.model_validate(raw)
                    self._register_provider(definition)
                except Exception:
                    # Not all directories contain valid provider definitions — skip
                    logger.debug(
                        "Skipping non-provider definition: %s", definition_path
                    )

            return self._providers
        except Exception as exc:
            raise MatimoError(
                "Failed to load OAuth2 provider definitions",
                ErrorCode.TOOL_NOT_FOUND,
                details={
                    "tools_path": str(self._tools_path),
                    "error": str(exc),
                },
            ) from exc

    def get_provider(self, provider_name: str) -> OAuth2Endpoints | None:
        """Get endpoints for a specific provider, or ``None``."""
        return self._providers.get(provider_name)

    def get_definition(self, provider_name: str) -> ProviderDefinition | None:
        """Get the full provider definition."""
        return self._definitions.get(provider_name)

    def list_providers(self) -> list[str]:
        """List all loaded provider names."""
        return list(self._providers.keys())

    # ------------------------------------------------------------------

    def _register_provider(self, definition: ProviderDefinition) -> None:
        name = definition.provider.name
        self._providers[name] = definition.provider.endpoints
        self._definitions[name] = definition
