#!/usr/bin/env python3
"""
============================================================================
META-TOOLS INTEGRATION DEMO
============================================================================

PATTERN: Meta-Tools for Tool Lifecycle Management
────────────────────────────────────────────────────────────────────────────
Demonstrates meta-tools which are built-in Matimo tools that help manage
the tool lifecycle. They allow agents to:

- List available tools
- Validate new tool definitions
- Create tools on disk
- Check tool status and risk levels
- Reload the tool registry

This enables agents to dynamically discover, create, and validate tools
without needing special privileges.

SETUP:
────────────────────────────────────────────────────────────────────────────
  No API keys required. Uses built-in meta-tools.

USAGE:
────────────────────────────────────────────────────────────────────────────
  uv run python meta_flow/meta_tools_integration.py

============================================================================
"""

import asyncio
from pathlib import Path
from dotenv import load_dotenv

from matimo import Matimo

load_dotenv(Path(__file__).parent.parent.parent / ".env")


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Meta-Tools Integration Demo                       ║")
    print("║     (Tool lifecycle management showcase)              ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # ── Initialize Matimo ─────────────────────────────────────────────────────
    print("🚀  Initializing Matimo…")
    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    print(f"✅  Loaded {len(all_tools)} tools\n")

    # ── Find and list meta-tools ──────────────────────────────────────────────
    print("📋  Discovering Meta-Tools\n")
    meta_tools = [t for t in all_tools if t.name.startswith("matimo_")]
    print(f"Found {len(meta_tools)} meta-tools:\n")

    meta_tools_info = {
        "matimo_list_tools": {
            "purpose": "List all available tools with metadata",
            "use_case": "Discover what tools are available",
        },
        "matimo_validate_tool": {
            "purpose": "Validate a YAML tool definition",
            "use_case": "Check if a new tool is safe before deploying",
        },
        "matimo_create_tool": {
            "purpose": "Create a tool on disk from YAML",
            "use_case": "Agent-generated tools",
        },
        "matimo_get_tool_status": {
            "purpose": "Get status and risk level of a tool",
            "use_case": "Check if tool is approved/safe",
        },
        "matimo_reload_tools": {
            "purpose": "Reload tool registry from disk",
            "use_case": "Pick up newly created tools",
        },
    }

    for tool_name in sorted(meta_tools_info.keys()):
        info = meta_tools_info.get(tool_name)
        if tool_name in [t.name for t in meta_tools]:
            status = "✓ Available"
        else:
            status = "✗ Not available"
        
        print(f"{status:15} {tool_name}")
        print(f"{'':15} Purpose: {info['purpose']}")
        print(f"{'':15} Use: {info['use_case']}\n")

    # ── Example 1: List tools ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Example 1: List Available Tools")
    print("=" * 60 + "\n")

    print("Using: matimo.list_tools()")
    print(f"Total tools available: {len(all_tools)}\n")

    # Group tools by category
    categories = {}
    for tool in all_tools:
        # Extract category from name
        if "_" in tool.name:
            category = tool.name.split("_")[0]
        else:
            category = tool.name.split("-")[0] if "-" in tool.name else "core"
        
        if category not in categories:
            categories[category] = []
        categories[category].append(tool.name)

    for category, tools in sorted(categories.items()):
        tools_str = ", ".join(sorted(tools)[:3])
        if len(tools) > 3:
            tools_str += f", ... +{len(tools) - 3} more"
        print(f"  {category:15} {tools_str}")

    # ── Example 2: Validate tool definition ───────────────────────────────────
    print("\n" + "=" * 60)
    print("Example 2: Validate Tool Definition")
    print("=" * 60 + "\n")

    sample_tool = """
name: city_lookup
version: "1.0.0"
description: Look up city information
parameters:
  id:
    type: string
    required: true
    description: City ID (1-10)
execution:
  type: http
  method: GET
  url: https://jsonplaceholder.typicode.com/users/{id}
"""

    print("YAML Tool Definition:")
    for line in sample_tool.strip().split("\n")[:5]:
        print(f"  {line}")
    print(f"  ...\n")

    print("Validation Results (expected):")
    print("  ✓ Valid YAML syntax")
    print("  ✓ Required fields present")
    print("  ✓ Parameter types valid")
    print("  ✓ Execution type recognized")
    print("  ✓ Risk level: LOW")
    print("  ✓ No policy violations\n")

    # ── Example 3: Tool status ────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Example 3: Check Tool Status")
    print("=" * 60 + "\n")

    print("Query: matimo_get_tool_status")
    print("  Parameter: toolName='read'\n")

    print("Response:")
    print("  name: read")
    print("  version: 1.0.0")
    print("  description: Read file contents and metadata")
    print("  status: approved")
    print("  risk_level: medium (requires user approval)")
    print("  requires_approval: true")
    print("  approval_count: 1")
    print("  last_modified: 2024-01-15T10:30:00Z\n")

    # ── Example 4: Tool Lifecycle Flow ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Example 4: Complete Tool Lifecycle")
    print("=" * 60 + "\n")

    flow = """
STEP 1: Agent receives request
  "Create a tool to fetch weather data"

STEP 2: Agent uses meta-tools to validate YAML
  matimo_validate_tool(yaml_content=...)
  → Result: ✓ Valid, risk_level: LOW

STEP 3: Agent creates the tool
  matimo_create_tool(
    name: weather_api
    yaml_content: ...
    target_dir: ./tools
  )
  → Result: Created at ./tools/weather_api/definition.yaml

STEP 4: Agent reloads registry
  matimo_reload_tools()
  → Result: weather_api now available

STEP 5: Agent uses the new tool
  matimo.execute('weather_api', {city: 'NYC'})
  → Result: Weather data returned

STEP 6: Human reviews the tool
  matimo_get_tool_status(toolName='weather_api')
  → Status: draft, pending review

STEP 7: Human approves
  matimo_approve_tool(toolName='weather_api')
  → Result: status='approved'
"""

    print(flow)

    print("=" * 60)
    print("✨  Benefits of Meta-Tools")
    print("=" * 60)
    print("""
✓ Agents can discover and manage tools dynamically
✓ Validation ensures safety before deployment
✓ Clear audit trail of tool creation/modifications
✓ Human-in-the-loop approval for sensitive tools
✓ Hot-reloading without restart
✓ Enables self-improving agents (create tools as needed)
""")


if __name__ == "__main__":
    asyncio.run(main())
