"""
Matimo auth module — injection helpers and OAuth2 support.

Mirrors: packages/core/src/auth/
"""
from matimo.auth.injection import extract_parameter_placeholders, inject_auth_parameters
from matimo.auth.oauth2_config import (
    AuthorizationOptions,
    OAuth2Config,
    OAuth2Token,
    TokenResponse,
)
from matimo.auth.oauth2_handler import OAuth2Handler
from matimo.auth.oauth2_provider_loader import OAuth2ProviderLoader

__all__ = [
    # Injection
    "inject_auth_parameters",
    "extract_parameter_placeholders",
    # OAuth2
    "AuthorizationOptions",
    "OAuth2Config",
    "OAuth2Handler",
    "OAuth2ProviderLoader",
    "OAuth2Token",
    "TokenResponse",
]
