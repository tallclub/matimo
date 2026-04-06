"""
OAuth2Handler — Provider-Agnostic OAuth2 Flow Manager.

Mirrors: packages/core/src/auth/oauth2-handler.ts

Matimo's OAuth2 Scope:
  ✅ Help complete OAuth2 authorization with any provider
  ✅ Exchange authorization codes for tokens
  ✅ Support automatic token refresh if needed
  ✅ Work with Google, GitHub, Slack, or any OAuth2 provider
  ❌ Store tokens (User's responsibility)
  ❌ Manage token lifecycle (User's responsibility)

Pattern:
  Config → Get Auth URL → Exchange Code → Return Token → User Stores It
"""
from __future__ import annotations

import os
import secrets
import time
from urllib.parse import urlencode

import httpx

from matimo.auth.oauth2_config import (
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
    TokenResponse,
)
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader
from matimo.core.models import OAuth2Endpoints
from matimo.errors import ErrorCode, MatimoError


class OAuth2Handler:
    """
    Provider-agnostic OAuth2 flow manager.

    Usage::

        oauth2 = OAuth2Handler(OAuth2Config(
            provider="google",
            client_id=os.environ["CLIENT_ID"],
            client_secret=os.environ["CLIENT_SECRET"],
            redirect_uri="http://localhost:3000/callback",
        ))

        auth_url = oauth2.get_authorization_url(AuthorizationOptions(
            user_id="user-123",
            scopes=["https://www.googleapis.com/auth/gmail.readonly"],
        ))
        # → redirect user to auth_url

        token = await oauth2.exchange_code_for_token(code="...", user_id="user-123")
        # → store token yourself (Matimo does NOT store tokens)
    """

    _TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000  # 5 minutes before expiration

    def __init__(
        self,
        config: OAuth2Config,
        provider_loader: OAuth2ProviderLoader | None = None,
    ) -> None:
        if not config.client_id or not config.client_secret:
            raise MatimoError(
                "OAuth2 client_id and client_secret are required",
                ErrorCode.AUTH_FAILED,
                details={"provider": config.provider},
            )

        self._config = config
        self._token_refresh_buffer = self._TOKEN_REFRESH_BUFFER_MS
        self._provider_loader = provider_loader or OAuth2ProviderLoader("tools")
        self._endpoints = self._resolve_endpoints(config)

    # ------------------------------------------------------------------
    # Endpoint resolution (priority: config → env vars → YAML)
    # ------------------------------------------------------------------

    def _resolve_endpoints(self, config: OAuth2Config) -> OAuth2Endpoints:
        """
        Resolve OAuth2 endpoints with layered configuration.

        Priority (highest → lowest):
          1. config.endpoints — user provided at runtime
          2. Environment variables: OAUTH_{PROVIDER}_AUTH_URL, …
          3. YAML definition from provider loader
        """
        # Priority 1: runtime config
        if config.endpoints is not None:
            return config.endpoints

        # Priority 2: environment variables
        provider_upper = config.provider.upper()
        env_auth = os.environ.get(f"OAUTH_{provider_upper}_AUTH_URL")
        env_token = os.environ.get(f"OAUTH_{provider_upper}_TOKEN_URL")

        if env_auth or env_token:
            if not env_auth or not env_token:
                raise MatimoError(
                    f"Incomplete OAuth environment config for {config.provider}. "
                    f"Both OAUTH_{provider_upper}_AUTH_URL and "
                    f"OAUTH_{provider_upper}_TOKEN_URL must be set.",
                    ErrorCode.AUTH_FAILED,
                    details={"provider": config.provider},
                )
            return OAuth2Endpoints(
                authorization_url=env_auth,
                token_url=env_token,
                revoke_url=os.environ.get(f"OAUTH_{provider_upper}_REVOKE_URL"),
            )

        # Priority 3: YAML definition
        yaml_endpoints = self._provider_loader.get_provider(config.provider)
        if yaml_endpoints is not None:
            return yaml_endpoints

        raise MatimoError(
            f"Unsupported OAuth2 provider: {config.provider}. Provide endpoints via:\n"
            f"  1. config.endpoints (runtime override)\n"
            f"  2. OAUTH_{provider_upper}_AUTH_URL env var (deployment config)\n"
            f"  3. tools/{config.provider}/definition.yaml (YAML configuration)",
            ErrorCode.AUTH_FAILED,
            details={"provider": config.provider},
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def endpoints(self) -> OAuth2Endpoints:
        """Get resolved endpoints (useful for testing / debugging)."""
        return self._endpoints

    def get_authorization_url(self, options: AuthorizationOptions) -> str:
        """Generate authorization URL for the user to visit."""
        state = options.state or secrets.token_urlsafe(22)

        params: dict[str, str] = {
            "client_id": self._config.client_id,
            "redirect_uri": self._config.redirect_uri,
            "response_type": "code",
            "scope": " ".join(options.scopes),
            "state": state,
        }

        # Provider-specific parameters
        if self._config.provider == "google":
            params["access_type"] = "offline"
            params["prompt"] = "consent"

        return f"{self._endpoints.authorization_url}?{urlencode(params)}"

    async def exchange_code_for_token(
        self, code: str, user_id: str
    ) -> OAuth2Token:
        """Exchange an authorization code for an access token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._endpoints.token_url,
                    json={
                        "client_id": self._config.client_id,
                        "client_secret": self._config.client_secret,
                        "code": code,
                        "redirect_uri": self._config.redirect_uri,
                        "grant_type": "authorization_code",
                    },
                )
                response.raise_for_status()
                token_response = TokenResponse.model_validate(response.json())
                return self._parse_token_response(token_response, user_id)
        except httpx.HTTPStatusError as exc:
            raise MatimoError(
                "Failed to exchange authorization code for token",
                ErrorCode.AUTH_FAILED,
                details={
                    "provider": self._config.provider,
                    "status_code": exc.response.status_code,
                },
            ) from exc
        except Exception as exc:
            raise MatimoError(
                "Failed to exchange authorization code for token",
                ErrorCode.AUTH_FAILED,
                details={
                    "provider": self._config.provider,
                    "error": str(exc),
                },
            ) from exc

    async def refresh_token_if_needed(
        self, user_id: str, current_token: OAuth2Token
    ) -> OAuth2Token:
        """Refresh a token if it's expired or expiring soon."""
        if not self._is_token_expiring_soon(current_token):
            return current_token

        if not current_token.refresh_token:
            raise MatimoError(
                f"Cannot refresh token for user: {user_id} — no refresh_token available",
                ErrorCode.AUTH_FAILED,
                details={"user_id": user_id, "provider": self._config.provider},
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._endpoints.token_url,
                    json={
                        "client_id": self._config.client_id,
                        "client_secret": self._config.client_secret,
                        "refresh_token": current_token.refresh_token,
                        "grant_type": "refresh_token",
                    },
                )
                response.raise_for_status()
                token_response = TokenResponse.model_validate(response.json())
                return self._parse_token_response(
                    token_response,
                    user_id,
                    existing_refresh_token=current_token.refresh_token,
                )
        except Exception as exc:
            raise MatimoError(
                "Failed to refresh token",
                ErrorCode.AUTH_FAILED,
                details={
                    "user_id": user_id,
                    "provider": self._config.provider,
                    "error": str(exc),
                },
            ) from exc

    async def revoke_token(self, token: OAuth2Token) -> None:
        """Revoke a token (logout). No-op if provider lacks a revoke URL."""
        if not self._endpoints.revoke_url:
            return

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    self._endpoints.revoke_url,
                    json={
                        "client_id": self._config.client_id,
                        "client_secret": self._config.client_secret,
                        "token": token.access_token,
                    },
                )
        except Exception:
            # Log but don't fail — token may already be revoked
            pass

    def is_token_valid(self, token: OAuth2Token) -> bool:
        """Check if a token is valid (not expired)."""
        return _now_ms() < token.expires_at

    def set_token_refresh_buffer(self, milliseconds: int) -> None:
        """Set custom token refresh buffer (ms before expiration)."""
        self._token_refresh_buffer = milliseconds

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _is_token_expiring_soon(self, token: OAuth2Token) -> bool:
        return _now_ms() >= token.expires_at - self._token_refresh_buffer

    def _parse_token_response(
        self,
        response: TokenResponse,
        user_id: str,
        existing_refresh_token: str | None = None,
    ) -> OAuth2Token:
        return OAuth2Token(
            access_token=response.access_token,
            refresh_token=response.refresh_token or existing_refresh_token,
            expires_at=_now_ms() + response.expires_in * 1000,
            scopes=response.scope.split(" ") if response.scope else [],
            provider=self._config.provider,
            user_id=user_id,
        )


def _now_ms() -> int:
    """Current time in milliseconds (matches JS Date.now())."""
    return int(time.time() * 1000)
