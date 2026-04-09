"""
Secret resolver types and base protocol.
Mirrors: packages/core/src/mcp/secrets/types.ts
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class SecretResolver(Protocol):
    """
    Protocol for secret resolvers.
    Mirrors: SecretResolver interface in mcp/secrets/types.ts
    """

    name: str

    async def resolve(self, key: str) -> str | None: ...

    async def resolve_all(self, keys: list[str]) -> dict[str, str]: ...

    async def dispose(self) -> None: ...
