---
title: "Serve governed tools to Claude Desktop and Cursor"
description: "Expose your own Matimo tools to Claude Desktop, Cursor or Windsurf with one command, limit which tools are visible, and keep risky calls behind approval."
---
**The job:** give an MCP client (Claude Desktop, Cursor, Windsurf) a set of tools you choose, with the risky ones still behind a person.

## 1. Start the server

```bash
npm install matimo
npx matimo mcp setup                      # writes the Claude Desktop config
npx matimo mcp --tool-paths ./tools       # serve your tool directory over stdio
```

`npm install matimo` installs the core SDK and the CLI. Provider packages install separately, for example `npm install @matimo/slack`. For remote agents use `--transport http`, with a bearer token and TLS. See [MCP Server](/docs/mcp-server/) for client configuration for each tool.

## 2. Decide what is visible

```bash
# only these tools
npx matimo mcp --tools slack_send_channel_message,slack-list-channels

# everything except this one
npx matimo mcp --exclude postgres-execute-sql
```

## 3. Keep risky calls behind a person

When a call needs approval, the MCP server asks the person using the client through an MCP elicitation request. The call runs only if they accept. A client without elicitation gets an error saying there is no one to ask. The model is never given a way to approve its own call. Details are in [Approval over MCP](/docs/mcp-server/#approval-over-mcp).

## Limits

- Matimo does not authenticate your users. You supply the credentials for each tool, through environment variables, `.env`, Vault or AWS Secrets Manager.
- Whether approval prompts appear depends on the client supporting elicitation.
- The `matimo mcp` command line does not set `trustClientApproval` or `context`. Those are programmatic options.

## Read next

- [MCP Server](/docs/mcp-server/): transports, client config, secrets, filtering and approval
- [Authentication](/docs/user-guide/authentication/): how credentials reach a tool call
