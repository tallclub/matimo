#!/bin/bash
# Test MCP stdio server with manual JSON-RPC requests

echo "============================================"
echo "Testing Python MCP Stdio Transport"
echo "============================================"
echo ""

# Start the stdio server in the background
echo "🚀 Starting Matimo MCP stdio server..."
uv run python src/server_stdio.py > /tmp/stdio_server.log 2>&1 &
SERVER_PID=$!
sleep 2

echo "✓ Server started (PID: $SERVER_PID)"
echo ""

# Test 1: Initialize
echo "📨 Test 1: Sending initialize request..."
INIT_RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}' | uv run python src/server_stdio.py 2>&1 | head -1)
echo "Response: $INIT_RESPONSE"
echo ""

# Test 2: Kill and restart for tools/list
echo "🛑 Restarting server for tools/list test..."
kill $SERVER_PID 2>/dev/null || true
sleep 1

echo "📨 Test 2: Sending tools/list request..."
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  sleep 0.5
) | uv run python src/server_stdio.py 2>&1 | head -50

echo ""
echo "============================================"
echo "Test Complete"
echo "============================================"
