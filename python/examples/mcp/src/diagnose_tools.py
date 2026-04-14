#!/usr/bin/env python3
"""
Diagnostic script to verify tool discovery exactly as server_stdio.py does.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent examples dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))


async def main() -> None:
    """Diagnose tool loading."""
    import site
    from matimo import Matimo
    
    # ── Exact same paths as server_stdio.py ───────────────────────────────────
    workspace_root = "/Users/sajesh/My Work Directory/matimo"
    ts_tools = os.path.join(workspace_root, "typescript/examples/mcp/matimo-tools")
    
    site_packages_list = site.getsitepackages()
    
    print("\n" + "="*80)
    print("DIAGNOSTIC: Tool Discovery")
    print("="*80)
    
    print(f"\n📁 site-packages directories:")
    for sp in site_packages_list:
        print(f"   {sp}")
        
    print(f"\n📁 ts_tools path:")
    print(f"   {ts_tools}")
    print(f"   exists: {os.path.exists(ts_tools)}")
    
    if os.path.exists(ts_tools):
        tools_in_dir = os.listdir(ts_tools)
        print(f"   contents ({len(tools_in_dir)} items):")
        for item in sorted(tools_in_dir)[:10]:
            print(f"      - {item}")
        if len(tools_in_dir) > 10:
            print(f"      ... and {len(tools_in_dir) - 10} more")
    
    print(f"\n🔍 Checking for matimo_* packages in site-packages:")
    for sp in site_packages_list:
        if os.path.exists(sp):
            matimopkgs = [d for d in os.listdir(sp) if d.startswith("matimo_")]
            for pkg in sorted(matimopkgs):
                pkg_path = os.path.join(sp, pkg)
                tools_path = os.path.join(pkg_path, "tools")
                exists = "✓" if os.path.exists(tools_path) else "✗"
                print(f"   {exists} {pkg}/tools")
    
    # ── Now try initializing exactly like server_stdio.py ────────────────────
    print(f"\n⚡ Initialising Matimo...")
    print(f"   tool_paths = site_packages + ['{ts_tools}']")
    print(f"   auto_discover = True")
    
    matimo = await Matimo.init(
        tool_paths=site_packages_list + [ts_tools],
        auto_discover=True,
    )
    
    all_tools = matimo.list_tools()
    print(f"\n✅ Success! {len(all_tools)} tools loaded:")
    
    # Group by prefix
    prefixes = {}
    for tool in all_tools:
        prefix = tool.name.split("_")[0] if "_" in tool.name else tool.name.split("-")[0]
        if prefix not in prefixes:
            prefixes[prefix] = []
        prefixes[prefix].append(tool.name)
    
    for prefix in sorted(prefixes.keys()):
        names = prefixes[prefix]
        print(f"\n   {prefix}* ({len(names)} tools):")
        for name in sorted(names)[:5]:
            print(f"      • {name}")
        if len(names) > 5:
            print(f"      ... and {len(names) - 5} more")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    asyncio.run(main())
