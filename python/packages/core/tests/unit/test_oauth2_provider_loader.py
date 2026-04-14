"""Unit tests for auth/oauth2_provider_loader.py."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader


def _write_provider_definition(directory: Path, provider_name: str) -> None:
    """Write a valid provider definition.yaml to a subdirectory."""
    provider_dir = directory / provider_name
    provider_dir.mkdir(parents=True)
    content = f"""\
name: {provider_name}
type: provider
version: "1.0.0"
description: "{provider_name} OAuth2 provider"
provider:
  name: {provider_name}
  endpoints:
    authorizationUrl: "https://{provider_name}.example.com/oauth/authorize"
    tokenUrl: "https://{provider_name}.example.com/oauth/token"
    revokeUrl: "https://{provider_name}.example.com/oauth/revoke"
"""
    (provider_dir / "definition.yaml").write_text(content, encoding="utf-8")


class TestOAuth2ProviderLoader:
    async def test_load_providers_returns_endpoints(self, tmp_path: Path) -> None:
        _write_provider_definition(tmp_path, "github")
        loader = OAuth2ProviderLoader(str(tmp_path))
        providers = await loader.load_providers()
        assert "github" in providers
        assert urlparse(providers["github"].authorization_url).hostname == "github.example.com"

    async def test_load_multiple_providers(self, tmp_path: Path) -> None:
        for name in ["slack", "github", "google"]:
            _write_provider_definition(tmp_path, name)
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        names = loader.list_providers()
        assert set(names) == {"slack", "github", "google"}

    async def test_get_provider_returns_endpoints(self, tmp_path: Path) -> None:
        _write_provider_definition(tmp_path, "slack")
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        endpoints = loader.get_provider("slack")
        assert endpoints is not None
        assert urlparse(endpoints.authorization_url).hostname == "slack.example.com"

    async def test_get_provider_missing_returns_none(self, tmp_path: Path) -> None:
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        result = loader.get_provider("nonexistent")
        assert result is None

    async def test_load_providers_nonexistent_dir_returns_empty(self, tmp_path: Path) -> None:
        loader = OAuth2ProviderLoader(str(tmp_path / "no_such_dir"))
        providers = await loader.load_providers()
        assert providers == {}

    async def test_skip_non_provider_definition(self, tmp_path: Path) -> None:
        tool_dir = tmp_path / "my-tool"
        tool_dir.mkdir()
        # This has type=tool, not type=provider — should be skipped
        (tool_dir / "definition.yaml").write_text(
            "name: my-tool\ntype: tool\nversion: '1.0.0'\n",
            encoding="utf-8",
        )
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        assert loader.list_providers() == []

    async def test_skip_invalid_yaml_file(self, tmp_path: Path) -> None:
        bad_dir = tmp_path / "bad-provider"
        bad_dir.mkdir()
        (bad_dir / "definition.yaml").write_text("invalid: yaml: :::\n", encoding="utf-8")
        loader = OAuth2ProviderLoader(str(tmp_path))
        # Should not raise — invalid files are skipped gracefully
        await loader.load_providers()

    async def test_skip_directory_without_definition_yaml(self, tmp_path: Path) -> None:
        empty_dir = tmp_path / "empty-provider"
        empty_dir.mkdir()
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        assert loader.list_providers() == []

    async def test_list_providers_empty_initially(self, tmp_path: Path) -> None:
        loader = OAuth2ProviderLoader(str(tmp_path))
        assert loader.list_providers() == []

    async def test_get_definition_returns_full_definition(self, tmp_path: Path) -> None:
        _write_provider_definition(tmp_path, "notion")
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        definition = loader.get_definition("notion")
        assert definition is not None
        assert definition.name == "notion"
        assert definition.type == "provider"

    async def test_get_definition_missing_returns_none(self, tmp_path: Path) -> None:
        loader = OAuth2ProviderLoader(str(tmp_path))
        result = loader.get_definition("missing")
        assert result is None

    async def test_revoke_url_optional_in_provider_def(self, tmp_path: Path) -> None:
        provider_dir = tmp_path / "minimal"
        provider_dir.mkdir()
        content = """\
name: minimal
type: provider
version: "1.0.0"
provider:
  name: minimal
  endpoints:
    authorizationUrl: "https://minimal.example.com/authorize"
    tokenUrl: "https://minimal.example.com/token"
"""
        (provider_dir / "definition.yaml").write_text(content, encoding="utf-8")
        loader = OAuth2ProviderLoader(str(tmp_path))
        await loader.load_providers()
        endpoints = loader.get_provider("minimal")
        assert endpoints is not None
        assert endpoints.revoke_url is None
