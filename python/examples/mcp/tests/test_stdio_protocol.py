#!/usr/bin/env python3
"""Manual MCP protocol test for stdio server."""
import json
import subprocess
import time
import sys

# Start the MCP server
proc = subprocess.Popen(
    ["uv", "run", "python", "server_stdio.py"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    cwd="/Users/sajesh/My Work Directory/matimo/python/examples/mcp"
)

try:
    # Send initialize request
    init_msg = {
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    }
    
    proc.stdin.write(json.dumps(init_msg) + "\n")
    proc.stdin.flush()
    
    # Read response
    time.sleep(1)
    response = proc.stdout.readline()
    if response:
        resp_obj = json.loads(response)
        print("✓ Initialize response received", file=sys.stderr)
        print(f"  Server: {resp_obj.get('result', {}).get('serverInfo', {}).get('name')}", file=sys.stderr)
    
    # Send tools/list request
    list_msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
    
    proc.stdin.write(json.dumps(list_msg) + "\n")
    proc.stdin.flush()
    
    # Read response
    time.sleep(1)
    response = proc.stdout.readline()
    if response:
        resp_obj = json.loads(response)
        tools = resp_obj.get('result', {}).get('tools', [])
        print(f"✓ Tools list response received: {len(tools)} tools", file=sys.stderr)
        if tools:
            print(f"  First tool: {tools[0]['name']}", file=sys.stderr)
    
finally:
    proc.terminate()
    proc.wait(timeout=5)
