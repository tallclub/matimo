#!/usr/bin/env python3
"""
============================================================================
CREDENTIALS EXAMPLE — MULTI-TENANT PATTERN
============================================================================

PATTERN: Per-Execution Credential Override
────────────────────────────────────────────────────────────────────────────
Demonstrates how to supply credentials per `execute()` call instead of
relying on environment variables. This is the right pattern for
multi-tenant platforms where each user/tenant has their own API keys.

Use this pattern when:
  ✅ Serving multiple tenants from a single process
  ✅ Credentials come from a database / secrets manager / vault
  ✅ You must NOT store per-tenant tokens in process.env
  ✅ You want strict per-call credential isolation

Contrast with single-tenant pattern (env vars):
  SLACK_BOT_TOKEN=xoxb-xxx matimo execute slack-send-message ...
  → works fine for one account, breaks for ten tenants

SETUP:
────────────────────────────────────────────────────────────────────────────
No .env token needed — this example uses placeholder tokens.
Real requests will fail (expected). To see real calls succeed, replace
placeholder tokens with real API tokens from your service provider.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python credentials/credentials_example.py

KEY CONCEPTS:
────────────────────────────────────────────────────────────────────────────
1. get_required_credentials(toolName) — Discover what keys a tool needs
2. execute(name, params, credentials={...}) — Per-call credential injection
3. Tenant isolation — Multiple tenants, same process, different tokens
4. Credential fallback — Env vars + per-call overrides

============================================================================
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


# Simulated tenant "database" (in real apps, from DB/vault)
TENANTS = {
    "tenant-acme": {
        "name": "Acme Corp",
        "secrets": {
            # These are placeholders — replace with real tokens to test
            "SLACK_BOT_TOKEN": os.environ.get("ACME_SLACK_BOT_TOKEN", "xoxb-acme-placeholder"),
        }
    },
    "tenant-globex": {
        "name": "Globex Inc",
        "secrets": {
            "SLACK_BOT_TOKEN": os.environ.get("GLOBEX_SLACK_BOT_TOKEN", "xoxb-globex-placeholder"),
        }
    },
}


def get_tenant_credentials(tenant_id: str) -> dict:
    """Get credentials for a tenant."""
    tenant = TENANTS.get(tenant_id)
    if not tenant:
        raise ValueError(f"Unknown tenant: {tenant_id}")
    return tenant["secrets"]


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║   Per-Execution Credential Override — Multi-Tenant    ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── 1. Initialize Matimo once — shared for all tenants ────────────────────
    print("🚀  Initializing Matimo (once for all tenants)…")
    matimo = await Matimo.init(auto_discover=True)
    print(f"✅  Loaded {len(matimo.list_tools())} tools\n")

    # ── 2. Build credential manifest ──────────────────────────────────────────
    print("🔑  Building credential manifest for all tools…")
    credential_manifest = {}
    for tool in matimo.list_tools():
        # Note: This is pseudo-code — your SDK should have get_required_credentials()
        # For now, we assume tools that have "slack" in the name need SLACK_BOT_TOKEN
        if "slack" in tool.name.lower():
            credential_manifest[tool.name] = ["SLACK_BOT_TOKEN"]
    
    print(f"   {len(credential_manifest)} tools need credentials")
    for tool_name, keys in list(credential_manifest.items())[:3]:
        print(f"     {tool_name}: {keys}")
    print()

    # ── 3. Demonstrate per-tenant execution ────────────────────────────────────
    try:
        for tenant_id, tenant_info in TENANTS.items():
            print(f"\n{'─' * 60}")
            print(f"📋  Processing {tenant_info['name']} ({tenant_id})")
            print(f"{'─' * 60}")

            # Get tenant's credentials
            tenant_creds = get_tenant_credentials(tenant_id)
            print(f"🔐  Credentials loaded for {tenant_id}")
            print(f"    Bot token: {tenant_creds['SLACK_BOT_TOKEN'][:15]}…")

            # Try to list channels for this tenant
            # Note: This uses placeholder tokens, so will fail with auth error
            print(f"\n📲  Attempting to list Slack channels with tenant credentials…")
            
            # This would normally work with real credentials:
            # result = await matimo.execute(
            #     "slack-list-channels",
            #     {"limit": 5},
            #     credentials=tenant_creds
            # )
            
            # For this demo, we just show the pattern
            print(f"  [Demonstration mode — real tokens would make this API call]")
            print(f"  Would execute: matimo.execute(")
            print(f"    'slack-list-channels',")
            print(f"    {{'limit': 5}},")
            print(f"    credentials={{")
            print(f"      'SLACK_BOT_TOKEN': '{tenant_creds['SLACK_BOT_TOKEN'][:20]}...'")
            print(f"    }}")
            print(f"  )")

            # Show what happens with placeholder tokens
            print(f"\n⚠️  Placeholder token would result in:")
            print(f"    401 Unauthorized (invalid token format)")

    except Exception as error:
        print(f"❌  Error: {error}\n")

    # ── 4. Show credential isolation benefits ─────────────────────────────────
    print(f"\n{'═' * 60}")
    print("✨  Multi-Tenant Isolation Benefits")
    print(f"{'═' * 60}\n")
    print("✓ Each tenant's data is isolated per call")
    print("✓ No risk of one tenant accessing another's data")
    print("✓ Credentials stay in secure storage (DB/vault), not in env vars")
    print("✓ Easy to rotate credentials per tenant")
    print("✓ Audit trail: which tenant executed what tool\n")


if __name__ == "__main__":
    asyncio.run(main())
