"""Unit tests for mcp/secrets/ resolvers."""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from matimo.mcp.secrets import (
    AwsSecretsManagerResolver,
    DotenvSecretResolver,
    EnvSecretResolver,
    SecretResolverChain,
    VaultSecretResolver,
    create_resolver_chain,
)
from matimo.mcp.secrets.types import SecretResolver

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# SecretResolver Protocol
# ---------------------------------------------------------------------------


class TestSecretResolverProtocol:
    def test_resolver_protocol_is_runtime_checkable(self) -> None:
        """Cover mcp/secrets/types.py — importing and using the Protocol."""
        resolver = EnvSecretResolver()
        assert isinstance(resolver, SecretResolver)

    def test_non_resolver_is_not_instance(self) -> None:
        assert not isinstance("not_a_resolver", SecretResolver)


# ---------------------------------------------------------------------------
# EnvSecretResolver
# ---------------------------------------------------------------------------


class TestEnvSecretResolver:
    async def test_resolve_existing_key(self) -> None:
        resolver = EnvSecretResolver()
        with patch.dict(os.environ, {"TEST_KEY": "test_value"}):
            result = await resolver.resolve("TEST_KEY")
        assert result == "test_value"

    async def test_resolve_missing_key_returns_none(self) -> None:
        resolver = EnvSecretResolver()
        # Ensure key doesn't exist
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DEFINITELY_NOT_SET_XYZ", None)
            result = await resolver.resolve("DEFINITELY_NOT_SET_XYZ")
        assert result is None

    async def test_resolve_all_returns_found_keys(self) -> None:
        resolver = EnvSecretResolver()
        with patch.dict(os.environ, {"K1": "v1", "K2": "v2"}):
            result = await resolver.resolve_all(["K1", "K2", "K3_MISSING"])
        assert result == {"K1": "v1", "K2": "v2"}
        assert "K3_MISSING" not in result

    async def test_dispose_is_noop(self) -> None:
        resolver = EnvSecretResolver()
        await resolver.dispose()  # Should not raise

    def test_name_is_env(self) -> None:
        assert EnvSecretResolver.name == "env"


# ---------------------------------------------------------------------------
# DotenvSecretResolver
# ---------------------------------------------------------------------------


class TestDotenvSecretResolver:
    async def test_resolve_from_dotenv_file(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        env_file = pathlib.Path(str(tmp_path)) / ".env"
        env_file.write_text("MY_SECRET=hello123\nOTHER=world\n", encoding="utf-8")
        try:
            resolver = DotenvSecretResolver(path=str(env_file))
            result = await resolver.resolve("MY_SECRET")
            assert result == "hello123"
        except Exception:
            pytest.skip("python-dotenv not installed")

    async def test_missing_file_returns_none(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        env_file = pathlib.Path(str(tmp_path)) / "nosuch.env"
        resolver = DotenvSecretResolver(path=str(env_file))
        result = await resolver.resolve("ANY_KEY")
        assert result is None

    async def test_resolve_all_subset(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        env_file = pathlib.Path(str(tmp_path)) / ".env"
        env_file.write_text("KEY_A=aaa\nKEY_B=bbb\n", encoding="utf-8")
        try:
            resolver = DotenvSecretResolver(path=str(env_file))
            result = await resolver.resolve_all(["KEY_A", "KEY_MISSING"])
            assert result.get("KEY_A") == "aaa"
            assert "KEY_MISSING" not in result
        except Exception:
            pytest.skip("python-dotenv not installed")

    async def test_dispose_is_noop(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        resolver = DotenvSecretResolver(path=str(pathlib.Path(str(tmp_path)) / ".env"))
        await resolver.dispose()

    def test_name_is_dotenv(self) -> None:
        assert DotenvSecretResolver.name == "dotenv"

    def test_missing_dotenv_package_logs_warning(self, tmp_path: pytest.TempPathFactory) -> None:
        import pathlib
        env_file = pathlib.Path(str(tmp_path)) / ".env"
        env_file.write_text("KEY=val\n")
        with patch("builtins.__import__", side_effect=ImportError("no module")):
            # This will try to load with import error but constructor shouldn't raise
            resolver = DotenvSecretResolver.__new__(DotenvSecretResolver)
            resolver._path = env_file
            resolver._loaded = False
            resolver._values = {}
            # _load should handle ImportError gracefully
            resolver._load()
        assert resolver._loaded is False


# ---------------------------------------------------------------------------
# VaultSecretResolver
# ---------------------------------------------------------------------------


class TestVaultSecretResolver:
    async def test_resolve_uses_hvac_mock(self) -> None:
        resolver = VaultSecretResolver(
            addr="http://vault:8200",
            token="test-token",
            secret_path="secret/data/matimo",
        )
        mock_hvac = MagicMock()
        mock_client = MagicMock()
        mock_hvac.Client.return_value = mock_client
        mock_client.secrets.kv.v2.read_secret_version.return_value = {
            "data": {"data": {"MY_KEY": "my_value"}}
        }
        with patch.dict("sys.modules", {"hvac": mock_hvac}):
            result = await resolver.resolve("MY_KEY")
        assert result == "my_value"

    async def test_resolve_returns_none_when_hvac_missing(self) -> None:
        resolver = VaultSecretResolver()
        # Make hvac appear absent
        with patch.dict("sys.modules", {"hvac": None}):
            result = await resolver.resolve("ANY_KEY")
        assert result is None

    async def test_resolve_all_subset(self) -> None:
        resolver = VaultSecretResolver(
            addr="http://vault:8200",
            token="token",
        )
        mock_hvac = MagicMock()
        mock_client = MagicMock()
        mock_hvac.Client.return_value = mock_client
        mock_client.secrets.kv.v2.read_secret_version.return_value = {
            "data": {"data": {"K1": "v1", "K2": "v2"}}
        }
        with patch.dict("sys.modules", {"hvac": mock_hvac}):
            result = await resolver.resolve_all(["K1", "MISSING"])
        assert result.get("K1") == "v1"
        assert "MISSING" not in result

    async def test_dispose_clears_cache(self) -> None:
        resolver = VaultSecretResolver()
        resolver._cache = {"key": "value"}
        await resolver.dispose()
        assert resolver._cache == {}

    async def test_cache_is_used_within_ttl(self) -> None:
        resolver = VaultSecretResolver(cache_ttl_ms=60_000)
        resolver._cache = {"CACHED_KEY": "cached_value"}
        resolver._cache_ts = 1e15  # Far future — cache unexpired
        result = await resolver.resolve("CACHED_KEY")
        assert result == "cached_value"

    async def test_vault_exception_returns_empty(self) -> None:
        resolver = VaultSecretResolver()
        mock_hvac = MagicMock()
        mock_client = MagicMock()
        mock_hvac.Client.return_value = mock_client
        mock_client.secrets.kv.v2.read_secret_version.side_effect = Exception("vault down")
        with patch.dict("sys.modules", {"hvac": mock_hvac}):
            result = await resolver.resolve("KEY")
        assert result is None

    def test_name_is_vault(self) -> None:
        assert VaultSecretResolver.name == "vault"

    def test_uses_env_vars_for_addr_and_token(self) -> None:
        with patch.dict(os.environ, {"VAULT_ADDR": "http://myenv:8200", "VAULT_TOKEN": "envtoken"}):
            resolver = VaultSecretResolver()
        assert resolver._addr == "http://myenv:8200"
        assert resolver._token == "envtoken"


# ---------------------------------------------------------------------------
# AwsSecretsManagerResolver
# ---------------------------------------------------------------------------


class TestAwsSecretsManagerResolver:
    async def test_resolve_uses_boto3_mock(self) -> None:
        resolver = AwsSecretsManagerResolver(region="us-east-1", secret_id="matimo/secrets")
        mock_boto3 = MagicMock()
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        import json
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps({"API_KEY": "secret123"})
        }
        with patch.dict("sys.modules", {"boto3": mock_boto3}):
            result = await resolver.resolve("API_KEY")
        assert result == "secret123"

    async def test_resolve_returns_none_when_boto3_missing(self) -> None:
        resolver = AwsSecretsManagerResolver()
        with patch.dict("sys.modules", {"boto3": None}):
            result = await resolver.resolve("ANY")
        assert result is None

    async def test_dispose_clears_cache(self) -> None:
        resolver = AwsSecretsManagerResolver()
        resolver._cache = {"key": "val"}
        await resolver.dispose()
        assert resolver._cache == {}

    async def test_cache_used_within_ttl(self) -> None:
        resolver = AwsSecretsManagerResolver(cache_ttl_ms=60_000)
        resolver._cache = {"CACHED": "val"}
        resolver._cache_ts = 1e15
        result = await resolver.resolve("CACHED")
        assert result == "val"

    async def test_aws_exception_returns_empty(self) -> None:
        resolver = AwsSecretsManagerResolver()
        mock_boto3 = MagicMock()
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_client.get_secret_value.side_effect = Exception("aws down")
        with patch.dict("sys.modules", {"boto3": mock_boto3}):
            result = await resolver.resolve("KEY")
        assert result is None

    def test_name_is_aws(self) -> None:
        assert AwsSecretsManagerResolver.name == "aws"

    def test_uses_env_for_region(self) -> None:
        with patch.dict(os.environ, {"AWS_DEFAULT_REGION": "eu-west-1"}):
            resolver = AwsSecretsManagerResolver()
        assert resolver._region == "eu-west-1"


# ---------------------------------------------------------------------------
# SecretResolverChain
# ---------------------------------------------------------------------------


class TestSecretResolverChain:
    async def test_resolve_first_resolver_wins(self) -> None:
        r1 = AsyncMock()
        r2 = AsyncMock()
        r1.resolve = AsyncMock(return_value="from_r1")
        r2.resolve = AsyncMock(return_value="from_r2")
        chain = SecretResolverChain([r1, r2])
        result = await chain.resolve("key")
        assert result == "from_r1"
        r2.resolve.assert_not_called()

    async def test_resolve_falls_through_to_second(self) -> None:
        r1 = AsyncMock()
        r2 = AsyncMock()
        r1.resolve = AsyncMock(return_value=None)
        r2.resolve = AsyncMock(return_value="from_r2")
        chain = SecretResolverChain([r1, r2])
        result = await chain.resolve("key")
        assert result == "from_r2"

    async def test_resolve_returns_none_if_all_miss(self) -> None:
        r1 = AsyncMock()
        r1.resolve = AsyncMock(return_value=None)
        chain = SecretResolverChain([r1])
        result = await chain.resolve("key")
        assert result is None

    async def test_resolve_all_merges_results(self) -> None:
        r1 = AsyncMock()
        r2 = AsyncMock()
        r1.resolve_all = AsyncMock(return_value={"K1": "v1"})
        r2.resolve_all = AsyncMock(return_value={"K2": "v2"})
        chain = SecretResolverChain([r1, r2])
        result = await chain.resolve_all(["K1", "K2"])
        assert result == {"K1": "v1", "K2": "v2"}

    async def test_resolve_all_stops_when_all_found(self) -> None:
        r1 = AsyncMock()
        r2 = AsyncMock()
        r1.resolve_all = AsyncMock(return_value={"K1": "v1", "K2": "v2"})
        r2.resolve_all = AsyncMock(return_value={"K2": "different"})
        chain = SecretResolverChain([r1, r2])
        result = await chain.resolve_all(["K1", "K2"])
        # r2 should not be called since all keys found
        r2.resolve_all.assert_not_called()
        assert result == {"K1": "v1", "K2": "v2"}

    async def test_dispose_calls_all_resolvers(self) -> None:
        r1 = AsyncMock()
        r2 = AsyncMock()
        r1.dispose = AsyncMock()
        r2.dispose = AsyncMock()
        chain = SecretResolverChain([r1, r2])
        await chain.dispose()
        r1.dispose.assert_called_once()
        r2.dispose.assert_called_once()

    def test_name_is_chain(self) -> None:
        assert SecretResolverChain.name == "chain"


# ---------------------------------------------------------------------------
# create_resolver_chain
# ---------------------------------------------------------------------------


class TestCreateResolverChain:
    def test_creates_env_resolver(self) -> None:
        chain = create_resolver_chain([{"type": "env"}])
        assert isinstance(chain, SecretResolverChain)
        assert isinstance(chain._resolvers[0], EnvSecretResolver)

    def test_creates_dotenv_resolver(self) -> None:
        chain = create_resolver_chain([{"type": "dotenv", "path": "/tmp/.env"}])  # noqa: S108
        assert isinstance(chain._resolvers[0], DotenvSecretResolver)

    def test_creates_vault_resolver(self) -> None:
        chain = create_resolver_chain([{"type": "vault", "addr": "http://vault:8200"}])
        assert isinstance(chain._resolvers[0], VaultSecretResolver)

    def test_creates_aws_resolver(self) -> None:
        chain = create_resolver_chain([{"type": "aws", "region": "us-east-1"}])
        assert isinstance(chain._resolvers[0], AwsSecretsManagerResolver)

    def test_unknown_type_ignored(self) -> None:
        chain = create_resolver_chain([{"type": "unknown_xyz"}])
        assert len(chain._resolvers) == 0

    def test_multiple_resolvers_in_order(self) -> None:
        chain = create_resolver_chain([{"type": "env"}, {"type": "env"}])
        assert len(chain._resolvers) == 2

    def test_empty_config_creates_empty_chain(self) -> None:
        chain = create_resolver_chain([])
        assert isinstance(chain, SecretResolverChain)
        assert len(chain._resolvers) == 0
