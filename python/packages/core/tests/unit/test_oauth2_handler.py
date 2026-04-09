"""Unit tests for auth/oauth2_handler.py."""
from __future__ import annotations

import time
from unittest.mock import MagicMock

import httpx
import pytest
import respx

from matimo.auth.oauth2_config import (
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
)
from matimo.auth.oauth2_handler import OAuth2Handler, _now_ms
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader
from matimo.core.models import OAuth2Endpoints
from matimo.errors import ErrorCode, MatimoError


def _make_config(
    provider: str = "test-provider",
    endpoints: OAuth2Endpoints | None = None,
) -> OAuth2Config:
    return OAuth2Config(
        provider=provider,
        client_id="test_client_id",
        client_secret="test_client_secret",  # noqa: S106
        redirect_uri="http://localhost:3000/callback",
        endpoints=endpoints,
    )


def _make_endpoints() -> OAuth2Endpoints:
    return OAuth2Endpoints(
        authorization_url="https://auth.example.com/oauth/authorize",
        token_url="https://auth.example.com/oauth/token",
        revoke_url="https://auth.example.com/oauth/revoke",
        populate_by_name=True,
    )


def _make_valid_token(expires_in_future: bool = True) -> OAuth2Token:
    return OAuth2Token(
        access_token="access_token_value",
        refresh_token="refresh_token_value",
        expires_at=_now_ms() + (3_600_000 if expires_in_future else -1000),
        scopes=["read"],
        provider="test-provider",
        user_id="user-123",
    )


class TestOAuth2HandlerInit:
    def test_init_with_valid_config(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        assert handler.endpoints.authorization_url == "https://auth.example.com/oauth/authorize"

    def test_init_missing_client_id_raises(self) -> None:
        config = OAuth2Config(
            provider="p",
            client_id="",
            client_secret="secret",  # noqa: S106
            redirect_uri="http://localhost/cb",
            endpoints=_make_endpoints(),
        )
        with pytest.raises(MatimoError) as exc_info:
            OAuth2Handler(config)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED

    def test_init_missing_client_secret_raises(self) -> None:
        config = OAuth2Config(
            provider="p",
            client_id="client_id",
            client_secret="",
            redirect_uri="http://localhost/cb",
            endpoints=_make_endpoints(),
        )
        with pytest.raises(MatimoError) as exc_info:
            OAuth2Handler(config)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED


class TestEndpointResolution:
    def test_config_endpoints_take_priority(self) -> None:
        endpoints = _make_endpoints()
        config = _make_config(endpoints=endpoints)
        handler = OAuth2Handler(config)
        assert handler.endpoints.token_url == "https://auth.example.com/oauth/token"

    def test_env_vars_used_when_no_config_endpoints(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OAUTH_TEST_PROVIDER_AUTH_URL", "https://env.auth.com/authorize")
        monkeypatch.setenv("OAUTH_TEST_PROVIDER_TOKEN_URL", "https://env.auth.com/token")
        config = _make_config(provider="test_provider", endpoints=None)
        handler = OAuth2Handler(config)
        assert handler.endpoints.authorization_url == "https://env.auth.com/authorize"
        assert handler.endpoints.token_url == "https://env.auth.com/token"

    def test_env_vars_revoke_optional(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OAUTH_TEST_PROVIDER_AUTH_URL", "https://env.auth.com/authorize")
        monkeypatch.setenv("OAUTH_TEST_PROVIDER_TOKEN_URL", "https://env.auth.com/token")
        monkeypatch.setenv("OAUTH_TEST_PROVIDER_REVOKE_URL", "https://env.auth.com/revoke")
        config = _make_config(provider="test_provider", endpoints=None)
        handler = OAuth2Handler(config)
        assert handler.endpoints.revoke_url == "https://env.auth.com/revoke"

    def test_only_auth_url_env_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OAUTH_PARTIAL_AUTH_URL", "https://env.auth.com/authorize")
        monkeypatch.delenv("OAUTH_PARTIAL_TOKEN_URL", raising=False)
        config = _make_config(provider="partial", endpoints=None)
        mock_loader = MagicMock(spec=OAuth2ProviderLoader)
        mock_loader.get_provider.return_value = None
        with pytest.raises(MatimoError) as exc_info:
            OAuth2Handler(config, provider_loader=mock_loader)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED

    def test_yaml_provider_loader_fallback(self) -> None:
        mock_loader = MagicMock(spec=OAuth2ProviderLoader)
        yaml_endpoints = _make_endpoints()
        mock_loader.get_provider.return_value = yaml_endpoints
        config = _make_config(provider="custom", endpoints=None)
        handler = OAuth2Handler(config, provider_loader=mock_loader)
        assert handler.endpoints.token_url == yaml_endpoints.token_url

    def test_no_endpoint_source_raises(self) -> None:
        mock_loader = MagicMock(spec=OAuth2ProviderLoader)
        mock_loader.get_provider.return_value = None
        config = _make_config(provider="unknown", endpoints=None)
        with pytest.raises(MatimoError) as exc_info:
            OAuth2Handler(config, provider_loader=mock_loader)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED


class TestGetAuthorizationUrl:
    def test_returns_url_with_required_params(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        url = handler.get_authorization_url(
            AuthorizationOptions(scopes=["read", "write"], user_id="user-1")
        )
        assert "client_id=test_client_id" in url
        assert "response_type=code" in url
        assert "scope=" in url
        assert "state=" in url

    def test_custom_state_preserved(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        url = handler.get_authorization_url(
            AuthorizationOptions(scopes=["read"], user_id="user-1", state="custom-state")
        )
        assert "state=custom-state" in url

    def test_google_provider_adds_extra_params(self) -> None:
        endpoints = OAuth2Endpoints(
            authorization_url="https://accounts.google.com/o/oauth2/auth",
            token_url="https://oauth2.googleapis.com/token",
            populate_by_name=True,
        )
        config = OAuth2Config(
            provider="google",
            client_id="google_client_id",
            client_secret="google_secret",  # noqa: S106
            redirect_uri="http://localhost/cb",
            endpoints=endpoints,
        )
        handler = OAuth2Handler(config)
        url = handler.get_authorization_url(
            AuthorizationOptions(scopes=["email"], user_id="user-1")
        )
        assert "access_type=offline" in url
        assert "prompt=consent" in url


class TestExchangeCodeForToken:
    @respx.mock
    async def test_exchange_code_success(self) -> None:
        respx.post("https://auth.example.com/oauth/token").mock(
            return_value=httpx.Response(
                200,
                json={
                    "access_token": "token_abc",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                    "refresh_token": "refresh_abc",
                    "scope": "read write",
                },
            )
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = await handler.exchange_code_for_token("auth_code_123", "user-1")
        assert token.access_token == "token_abc"
        assert token.refresh_token == "refresh_abc"
        assert "read" in token.scopes
        assert token.user_id == "user-1"

    @respx.mock
    async def test_exchange_code_http_error_raises(self) -> None:
        respx.post("https://auth.example.com/oauth/token").mock(
            return_value=httpx.Response(400, json={"error": "invalid_grant"})
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        with pytest.raises(MatimoError) as exc_info:
            await handler.exchange_code_for_token("bad_code", "user-1")
        assert exc_info.value.code == ErrorCode.AUTH_FAILED

    @respx.mock
    async def test_exchange_code_network_error_raises(self) -> None:
        respx.post("https://auth.example.com/oauth/token").mock(
            side_effect=httpx.ConnectError("network error")
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        with pytest.raises(MatimoError) as exc_info:
            await handler.exchange_code_for_token("some_code", "user-1")
        assert exc_info.value.code == ErrorCode.AUTH_FAILED


class TestRefreshTokenIfNeeded:
    async def test_valid_token_not_refreshed(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = _make_valid_token(expires_in_future=True)
        result = await handler.refresh_token_if_needed("user-1", token)
        assert result is token

    async def test_expired_token_without_refresh_token_raises(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = OAuth2Token(
            access_token="old",
            refresh_token=None,
            expires_at=_now_ms() - 1000,  # expired
            scopes=[],
            provider="test-provider",
            user_id="user-1",
        )
        with pytest.raises(MatimoError) as exc_info:
            await handler.refresh_token_if_needed("user-1", token)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED

    @respx.mock
    async def test_expiring_token_refreshed(self) -> None:
        respx.post("https://auth.example.com/oauth/token").mock(
            return_value=httpx.Response(
                200,
                json={
                    "access_token": "new_token",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                },
            )
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        # Token expires within the buffer period (5 min = 300s)
        token = OAuth2Token(
            access_token="old_token",
            refresh_token="refresh_token_value",
            expires_at=_now_ms() + 60_000,  # expires in 1 min (< 5 min buffer)
            scopes=["read"],
            provider="test-provider",
            user_id="user-1",
        )
        result = await handler.refresh_token_if_needed("user-1", token)
        assert result.access_token == "new_token"
        # Existing refresh token preserved when new response has none
        assert result.refresh_token == "refresh_token_value"

    @respx.mock
    async def test_refresh_failure_raises(self) -> None:
        respx.post("https://auth.example.com/oauth/token").mock(
            return_value=httpx.Response(401, json={"error": "invalid_token"})
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = OAuth2Token(
            access_token="old",
            refresh_token="rt",
            expires_at=_now_ms() + 60_000,
            scopes=[],
            provider="test-provider",
            user_id="user-1",
        )
        with pytest.raises(MatimoError) as exc_info:
            await handler.refresh_token_if_needed("user-1", token)
        assert exc_info.value.code == ErrorCode.AUTH_FAILED


class TestRevokeToken:
    async def test_revoke_no_revoke_url_is_noop(self) -> None:
        config = _make_config(endpoints=OAuth2Endpoints(
            authorization_url="https://auth.example.com/oauth/authorize",
            token_url="https://auth.example.com/oauth/token",
            populate_by_name=True,
        ))
        handler = OAuth2Handler(config)
        token = _make_valid_token()
        # Should not raise even when revoke_url is None
        await handler.revoke_token(token)

    @respx.mock
    async def test_revoke_posts_to_revoke_url(self) -> None:
        revoke_mock = respx.post("https://auth.example.com/oauth/revoke").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = _make_valid_token()
        await handler.revoke_token(token)
        assert revoke_mock.called

    @respx.mock
    async def test_revoke_exception_is_silent(self) -> None:
        respx.post("https://auth.example.com/oauth/revoke").mock(
            side_effect=httpx.ConnectError("gone")
        )
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = _make_valid_token()
        # Should not raise
        await handler.revoke_token(token)


class TestIsTokenValid:
    def test_future_expiry_is_valid(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = _make_valid_token(expires_in_future=True)
        assert handler.is_token_valid(token) is True

    def test_past_expiry_is_invalid(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        token = OAuth2Token(
            access_token="x",
            expires_at=_now_ms() - 1000,
            scopes=[],
            provider="p",
            user_id="u",
        )
        assert handler.is_token_valid(token) is False


class TestSetTokenRefreshBuffer:
    def test_set_refresh_buffer(self) -> None:
        config = _make_config(endpoints=_make_endpoints())
        handler = OAuth2Handler(config)
        handler.set_token_refresh_buffer(60_000)
        assert handler._token_refresh_buffer == 60_000


class TestNowMs:
    def test_now_ms_is_integer(self) -> None:
        result = _now_ms()
        assert isinstance(result, int)

    def test_now_ms_is_recent(self) -> None:
        before = int(time.time() * 1000)
        result = _now_ms()
        after = int(time.time() * 1000)
        assert before <= result <= after
