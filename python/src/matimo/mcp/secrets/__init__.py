"""
Secret resolvers: env, dotenv, vault (HashiCorp), AWS Secrets Manager.
Mirrors: packages/core/src/mcp/secrets/
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("matimo")


# ---------------------------------------------------------------------------
# EnvSecretResolver
# ---------------------------------------------------------------------------


class EnvSecretResolver:
    """Resolves secrets from process environment variables."""

    name = "env"

    async def resolve(self, key: str) -> str | None:
        return os.environ.get(key)

    async def resolve_all(self, keys: list[str]) -> dict[str, str]:
        return {k: v for k in keys if (v := os.environ.get(k)) is not None}

    async def dispose(self) -> None:
        pass


# ---------------------------------------------------------------------------
# DotenvSecretResolver
# ---------------------------------------------------------------------------


class DotenvSecretResolver:
    """Reads secrets from a .env file (python-dotenv required)."""

    name = "dotenv"

    def __init__(self, path: str = ".env") -> None:
        self._path = Path(path)
        self._loaded = False
        self._values: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            logger.debug("DotenvSecretResolver: file not found at %s", self._path)
            return
        try:
            from dotenv import dotenv_values  # type: ignore[import]
            self._values = {k: v for k, v in dotenv_values(self._path).items() if v is not None}
            self._loaded = True
        except ImportError:
            logger.warning(
                "python-dotenv not installed — DotenvSecretResolver unavailable. "
                "Install with: pip install matimo[dotenv]"
            )

    async def resolve(self, key: str) -> str | None:
        return self._values.get(key)

    async def resolve_all(self, keys: list[str]) -> dict[str, str]:
        return {k: v for k in keys if (v := self._values.get(k)) is not None}

    async def dispose(self) -> None:
        pass


# ---------------------------------------------------------------------------
# VaultSecretResolver (HashiCorp Vault)
# ---------------------------------------------------------------------------


class VaultSecretResolver:
    """Reads secrets from HashiCorp Vault KV store (hvac required)."""

    name = "vault"

    def __init__(
        self,
        addr: str | None = None,
        token: str | None = None,
        secret_path: str = "secret/data/matimo",
        namespace: str | None = None,
        cache_ttl_ms: int = 300_000,
    ) -> None:
        self._addr = addr or os.environ.get("VAULT_ADDR", "http://127.0.0.1:8200")
        self._token = token or os.environ.get("VAULT_TOKEN", "")
        self._secret_path = secret_path
        self._namespace = namespace
        self._cache_ttl_s = cache_ttl_ms / 1000.0
        self._cache: dict[str, str] = {}
        self._cache_ts: float = 0.0

    async def resolve(self, key: str) -> str | None:
        all_secrets = await self._fetch_all()
        return all_secrets.get(key)

    async def resolve_all(self, keys: list[str]) -> dict[str, str]:
        all_secrets = await self._fetch_all()
        return {k: v for k in keys if (v := all_secrets.get(k)) is not None}

    async def dispose(self) -> None:
        self._cache.clear()

    async def _fetch_all(self) -> dict[str, str]:
        now = time.monotonic()
        if self._cache and (now - self._cache_ts) < self._cache_ttl_s:
            return self._cache
        try:
            import hvac  # type: ignore[import]
        except ImportError:
            logger.warning(
                "hvac not installed — VaultSecretResolver unavailable. "
                "Install with: pip install matimo[vault]"
            )
            return {}
        try:
            client = hvac.Client(url=self._addr, token=self._token, namespace=self._namespace)
            resp: Any = client.secrets.kv.v2.read_secret_version(path=self._secret_path)
            data: dict[str, Any] = resp.get("data", {}).get("data", {})
            self._cache = {k: str(v) for k, v in data.items()}
            self._cache_ts = now
        except Exception as exc:
            logger.error("VaultSecretResolver failed: %s", exc)
        return self._cache


# ---------------------------------------------------------------------------
# AwsSecretsManagerResolver
# ---------------------------------------------------------------------------


class AwsSecretsManagerResolver:
    """Reads secrets from AWS Secrets Manager (boto3 required)."""

    name = "aws"

    def __init__(
        self,
        region: str | None = None,
        secret_id: str = "matimo/secrets",
        cache_ttl_ms: int = 300_000,
    ) -> None:
        self._region = region or os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        self._secret_id = secret_id
        self._cache_ttl_s = cache_ttl_ms / 1000.0
        self._cache: dict[str, str] = {}
        self._cache_ts: float = 0.0

    async def resolve(self, key: str) -> str | None:
        all_secrets = await self._fetch_all()
        return all_secrets.get(key)

    async def resolve_all(self, keys: list[str]) -> dict[str, str]:
        all_secrets = await self._fetch_all()
        return {k: v for k in keys if (v := all_secrets.get(k)) is not None}

    async def dispose(self) -> None:
        self._cache.clear()

    async def _fetch_all(self) -> dict[str, str]:
        import json as _json

        now = time.monotonic()
        if self._cache and (now - self._cache_ts) < self._cache_ttl_s:
            return self._cache
        try:
            import boto3  # type: ignore[import]
        except ImportError:
            logger.warning(
                "boto3 not installed — AwsSecretsManagerResolver unavailable. "
                "Install with: pip install matimo[aws]"
            )
            return {}
        try:
            client = boto3.client("secretsmanager", region_name=self._region)
            resp = client.get_secret_value(SecretId=self._secret_id)
            raw = resp.get("SecretString", "{}")
            data = _json.loads(raw)
            self._cache = {k: str(v) for k, v in data.items()}
            self._cache_ts = now
        except Exception as exc:
            logger.error("AwsSecretsManagerResolver failed: %s", exc)
        return self._cache


# ---------------------------------------------------------------------------
# SecretResolverChain
# ---------------------------------------------------------------------------


class SecretResolverChain:
    """
    Try a list of resolvers in order, returning the first successful result.
    Mirrors: SecretResolverChain in resolver-chain.ts
    """

    name = "chain"

    def __init__(
        self,
        resolvers: list[Any],
    ) -> None:
        self._resolvers = resolvers

    async def resolve(self, key: str) -> str | None:
        for r in self._resolvers:
            val = await r.resolve(key)
            if val is not None:
                return val
        return None

    async def resolve_all(self, keys: list[str]) -> dict[str, str]:
        result: dict[str, str] = {}
        remaining = list(keys)
        for r in self._resolvers:
            if not remaining:
                break
            found = await r.resolve_all(remaining)
            result.update(found)
            remaining = [k for k in remaining if k not in result]
        return result

    async def dispose(self) -> None:
        for r in self._resolvers:
            await r.dispose()


def create_resolver_chain(resolver_configs: list[dict[str, Any]]) -> SecretResolverChain:
    """
    Build a SecretResolverChain from a list of config dicts.
    Each config must have a 'type' key: 'env' | 'dotenv' | 'vault' | 'aws'.
    """
    resolvers: list[Any] = []
    for cfg in resolver_configs:
        kind = cfg.get("type", "env")
        if kind == "env":
            resolvers.append(EnvSecretResolver())
        elif kind == "dotenv":
            resolvers.append(DotenvSecretResolver(path=cfg.get("path", ".env")))
        elif kind == "vault":
            resolvers.append(VaultSecretResolver(
                addr=cfg.get("addr"),
                token=cfg.get("token"),
                secret_path=cfg.get("secret_path", "secret/data/matimo"),
                namespace=cfg.get("namespace"),
                cache_ttl_ms=cfg.get("cache_ttl_ms", 300_000),
            ))
        elif kind == "aws":
            resolvers.append(AwsSecretsManagerResolver(
                region=cfg.get("region"),
                secret_id=cfg.get("secret_id", "matimo/secrets"),
                cache_ttl_ms=cfg.get("cache_ttl_ms", 300_000),
            ))
    return SecretResolverChain(resolvers)
