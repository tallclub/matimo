"""
OAuth2 Configuration Types — PROVIDER-AGNOSTIC + YAML-DRIVEN.

Mirrors: packages/core/src/auth/oauth2-config.ts

Matimo supports OAuth2 for any provider via YAML configuration.
Provider definitions are loaded from tools/[provider]/definition.yaml.

Configuration Priority (highest → lowest):
  1. ``config.endpoints`` — runtime override (user provides directly)
  2. ``OAUTH_PROVIDER_AUTH_URL`` env var — deployment override
  3. YAML definition (tools/[provider]/definition.yaml) — package default
"""
from __future__ import annotations

from pydantic import BaseModel, Field

# Re-export the endpoint model from core (single source of truth)
from matimo.core.models import OAuth2Endpoints

__all__ = [
    "OAuth2Endpoints",
    "OAuth2Config",
    "AuthorizationOptions",
    "TokenResponse",
    "OAuth2Token",
]


class OAuth2Config(BaseModel):
    """
    Provider-agnostic OAuth2 configuration.

    Same interface works for Google, GitHub, Slack, etc.
    Provider endpoints come from YAML definitions.
    """

    provider: str
    client_id: str
    client_secret: str
    redirect_uri: str
    endpoints: OAuth2Endpoints | None = None


class AuthorizationOptions(BaseModel):
    """Options for generating an authorization URL."""

    scopes: list[str]
    user_id: str
    state: str | None = None


class TokenResponse(BaseModel):
    """Raw token response from the OAuth2 provider."""

    access_token: str
    refresh_token: str | None = None
    expires_in: int  # seconds
    token_type: str = "Bearer"  # noqa: S105
    scope: str | None = None


class OAuth2Token(BaseModel):
    """
    Structured token returned by OAuth2Handler.

    Store this in your DB/file/cache — Matimo does NOT store tokens.
    Pass ``access_token`` to any Matimo tool that needs OAuth.
    """

    access_token: str
    refresh_token: str | None = None
    expires_at: int  # Unix timestamp in *milliseconds*
    scopes: list[str] = Field(default_factory=list)
    provider: str
    user_id: str
