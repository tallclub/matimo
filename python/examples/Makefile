.PHONY: help install \
  slack-factory slack-decorator slack-langchain slack-crewai \
  github-factory github-decorator github-langchain github-approval github-crewai \
  gmail-factory gmail-decorator gmail-langchain gmail-crewai \
  postgres-factory postgres-decorator postgres-langchain postgres-approval postgres-crewai \
  notion-factory notion-decorator notion-langchain notion-crewai \
  hubspot-factory hubspot-decorator hubspot-langchain hubspot-crewai \
  microsoft-factory microsoft-decorator microsoft-langchain microsoft-crewai \
  mailchimp-factory mailchimp-decorator mailchimp-langchain mailchimp-crewai \
  twilio-factory twilio-decorator twilio-langchain twilio-crewai \
  execute-factory execute-decorator execute-langchain \
  read-factory read-decorator read-langchain \
  search-factory search-decorator search-langchain \
  web-factory web-decorator web-langchain \
  edit-factory edit-decorator edit-langchain \
  extract-from-file-factory extract-from-file-decorator extract-from-file-langchain extract-from-file-crewai \
  convert-to-file-factory convert-to-file-decorator convert-to-file-langchain convert-to-file-crewai \
  web-scraper-factory web-scraper-decorator web-scraper-langchain web-scraper-crewai \
  credentials policy skills meta-flow \
  mcp-server-stdio mcp-server-http \
  mcp-agent-stdio mcp-agent-http mcp-agent mcp-agent-http-mode mcp-agent-multi mcp-diagnose mcp-test \
  agent-langchain agent-crewai multi-agent-crewai agent-langchain-skills-policy

# ── Detect the right Python runner ──────────────────────────────────────────
PYTHON := $(shell command -v uv >/dev/null 2>&1 && echo "uv run python" || echo "python")

help:
	@echo ""
	@echo "Matimo Python SDK - Examples"
	@echo "═══════════════════════════════════════════"
	@echo ""
	@echo "  make install              Install all dependencies"
	@echo ""
	@echo "  ─ Generic agents ──────────────────────────"
	@echo "  make agent-langchain      LangChain ReAct agent"
	@echo "  make agent-crewai         CrewAI single-agent (all tools)"
	@echo "  make multi-agent-crewai   CrewAI multi-agent crew (role-based tools)"
	@echo ""
	@echo "  ─ Slack ───────────────────────────────────"
	@echo "  make slack-factory        Direct tool execution (native)"
	@echo "  make slack-decorator      @tool decorator pattern (native)"
	@echo "  make slack-langchain      LangChain ReAct agent"
	@echo "  make slack-crewai         CrewAI agent"
	@echo ""
	@echo "  ─ GitHub ──────────────────────────────────"
	@echo "  make github-factory"
	@echo "  make github-decorator"
	@echo "  make github-langchain"
	@echo "  make github-approval      Human-in-the-loop (LangChain)"
	@echo "  make github-crewai"
	@echo ""
	@echo "  ─ Gmail ───────────────────────────────────"
	@echo "  make gmail-factory"
	@echo "  make gmail-decorator"
	@echo "  make gmail-langchain"
	@echo "  make gmail-crewai"
	@echo ""
	@echo "  ─ PostgreSQL ──────────────────────────────"
	@echo "  make postgres-factory"
	@echo "  make postgres-decorator"
	@echo "  make postgres-langchain"
	@echo "  make postgres-approval    Human-in-the-loop (LangChain)"
	@echo "  make postgres-crewai"
	@echo ""
	@echo "  ─ Notion ──────────────────────────────────"
	@echo "  make notion-factory"
	@echo "  make notion-decorator"
	@echo "  make notion-langchain"
	@echo "  make notion-crewai"
	@echo ""
	@echo "  ─ HubSpot ─────────────────────────────────"
	@echo "  make hubspot-factory"
	@echo "  make hubspot-decorator"
	@echo "  make hubspot-langchain"
	@echo "  make hubspot-crewai"
	@echo ""
	@echo "  ─ Microsoft Graph ─────────────────────────"
	@echo "  make microsoft-factory"
	@echo "  make microsoft-decorator"
	@echo "  make microsoft-langchain"
	@echo "  make microsoft-crewai"
	@echo ""
	@echo "  ─ Mailchimp ───────────────────────────────"
	@echo "  make mailchimp-factory"
	@echo "  make mailchimp-decorator"
	@echo "  make mailchimp-langchain"
	@echo "  make mailchimp-crewai"
	@echo ""
	@echo "  ─ Twilio ──────────────────────────────────"
	@echo "  make twilio-factory"
	@echo "  make twilio-decorator"
	@echo "  make twilio-langchain"
	@echo "  make twilio-crewai"
	@echo ""
	@echo "  ─ Generic Tools ───────────────────────────"
	@echo "  make execute-factory"
	@echo "  make execute-decorator"
	@echo "  make execute-langchain"
	@echo ""
	@echo "  make read-factory"
	@echo "  make read-decorator"
	@echo "  make read-langchain"
	@echo ""
	@echo "  make search-factory"
	@echo "  make search-decorator"
	@echo "  make search-langchain"
	@echo ""
	@echo "  make web-factory"
	@echo "  make web-decorator"
	@echo "  make web-langchain"
	@echo ""
	@echo "  make edit-factory"
	@echo "  make edit-decorator"
	@echo "  make edit-langchain"
	@echo ""
	@echo "  make extract-from-file-factory"
	@echo "  make extract-from-file-decorator"
	@echo "  make extract-from-file-langchain"
	@echo "  make extract-from-file-crewai"
	@echo ""
	@echo "  make convert-to-file-factory"
	@echo "  make convert-to-file-decorator"
	@echo "  make convert-to-file-langchain"
	@echo "  make convert-to-file-crewai"
	@echo ""
	@echo "  make web-scraper-factory"
	@echo "  make web-scraper-decorator"
	@echo "  make web-scraper-langchain"
	@echo "  make web-scraper-crewai"
	@echo ""
	@echo "  ─ Advanced Features ───────────────────────"
	@echo "  make credentials          Credential management demo"
	@echo "  make policy               Policy engine demo"
	@echo "  make skills               Skills knowledge layer demo"
	@echo "  make meta-flow            Meta-tools integration"
	@echo ""
	@echo "  ─ MCP ──────────────────────────────────────"
	@echo "  make mcp-server-stdio     Start MCP server (stdio transport)"
	@echo "  make mcp-server-http      Start MCP server (HTTP transport)"
	@echo "  make mcp-agent-stdio      LangChain agent via MCP (stdio only)"
	@echo "  make mcp-agent-http       LangChain agent via MCP (HTTP only)"
	@echo "  make mcp-agent            Unified agent (stdio mode, default)"
	@echo "  make mcp-agent-http-mode  Unified agent (HTTP mode)"
	@echo "  make mcp-agent-multi      Unified agent (stdio + HTTP combined)"
	@echo "  make mcp-diagnose         Diagnose and inspect available tools"
	@echo "  make mcp-test             Run MCP tests"
	@echo ""
	@echo "  ─ Advanced Agents ─────────────────────────"
	@echo "  make agent-langchain-skills-policy"

install:
	@echo "Installing matimo-examples dependencies..."
	uv sync

# ── Generic agents ────────────────────────────────────────────────────────────
agent-langchain:
	$(PYTHON) langchain/agents/langchain_agent.py
agent-crewai:
	$(PYTHON) crewai/agents/crewai_agent.py
multi-agent-crewai:
	$(PYTHON) crewai/agents/multi_agent_crew.py

# ── Slack ─────────────────────────────────────────────────────────────────────
slack-factory:
	$(PYTHON) native/slack/slack_factory.py
slack-decorator:
	$(PYTHON) native/slack/slack_decorator.py
slack-langchain:
	$(PYTHON) langchain/slack/slack_langchain.py
slack-crewai:
	$(PYTHON) crewai/slack/slack_crewai.py

# ── GitHub ────────────────────────────────────────────────────────────────────
github-factory:
	$(PYTHON) native/github/github_factory.py
github-decorator:
	$(PYTHON) native/github/github_decorator.py
github-langchain:
	$(PYTHON) langchain/github/github_langchain.py
github-approval:
	$(PYTHON) langchain/github/github_with_approval.py
github-crewai:
	$(PYTHON) crewai/github/github_crewai.py

# ── Gmail ─────────────────────────────────────────────────────────────────────
gmail-factory:
	$(PYTHON) native/gmail/gmail_factory.py
gmail-decorator:
	$(PYTHON) native/gmail/gmail_decorator.py
gmail-langchain:
	$(PYTHON) langchain/gmail/gmail_langchain.py
gmail-crewai:
	$(PYTHON) crewai/gmail/gmail_crewai.py

# ── PostgreSQL ────────────────────────────────────────────────────────────────
postgres-factory:
	$(PYTHON) native/postgres/postgres_factory.py
postgres-decorator:
	$(PYTHON) native/postgres/postgres_decorator.py
postgres-langchain:
	$(PYTHON) langchain/postgres/postgres_langchain.py
postgres-approval:
	$(PYTHON) langchain/postgres/postgres_with_approval.py
postgres-crewai:
	$(PYTHON) crewai/postgres/postgres_crewai.py

# ── Notion ────────────────────────────────────────────────────────────────────
notion-factory:
	$(PYTHON) native/notion/notion_factory.py
notion-decorator:
	$(PYTHON) native/notion/notion_decorator.py
notion-langchain:
	$(PYTHON) langchain/notion/notion_langchain.py
notion-crewai:
	$(PYTHON) crewai/notion/notion_crewai.py

# ── HubSpot ───────────────────────────────────────────────────────────────────
hubspot-factory:
	$(PYTHON) native/hubspot/hubspot_factory.py
hubspot-decorator:
	$(PYTHON) native/hubspot/hubspot_decorator.py
hubspot-langchain:
	$(PYTHON) langchain/hubspot/hubspot_langchain.py
hubspot-crewai:
	$(PYTHON) crewai/hubspot/hubspot_crewai.py

# ── Microsoft Graph ───────────────────────────────────────────────────────────
microsoft-factory:
	$(PYTHON) native/microsoft/microsoft_factory.py
microsoft-decorator:
	$(PYTHON) native/microsoft/microsoft_decorator.py
microsoft-langchain:
	$(PYTHON) langchain/microsoft/microsoft_langchain.py
microsoft-crewai:
	$(PYTHON) crewai/microsoft/microsoft_crewai.py

# ── Mailchimp ─────────────────────────────────────────────────────────────────
mailchimp-factory:
	$(PYTHON) native/mailchimp/mailchimp_factory.py
mailchimp-decorator:
	$(PYTHON) native/mailchimp/mailchimp_decorator.py
mailchimp-langchain:
	$(PYTHON) langchain/mailchimp/mailchimp_langchain.py
mailchimp-crewai:
	$(PYTHON) crewai/mailchimp/mailchimp_crewai.py

# ── Twilio ────────────────────────────────────────────────────────────────────
twilio-factory:
	$(PYTHON) native/twilio/twilio_factory.py
twilio-decorator:
	$(PYTHON) native/twilio/twilio_decorator.py
twilio-langchain:
	$(PYTHON) langchain/twilio/twilio_langchain.py
twilio-crewai:
	$(PYTHON) crewai/twilio/twilio_crewai.py

# ── Execute Tool ──────────────────────────────────────────────────────────────
execute-factory:
	$(PYTHON) native/execute/execute_factory.py
execute-decorator:
	$(PYTHON) native/execute/execute_decorator.py
execute-langchain:
	$(PYTHON) langchain/execute/execute_langchain.py

# ── Read Tool ─────────────────────────────────────────────────────────────────
read-factory:
	$(PYTHON) native/read/read_factory.py
read-decorator:
	$(PYTHON) native/read/read_decorator.py
read-langchain:
	$(PYTHON) langchain/read/read_langchain.py

# ── Search Tool ───────────────────────────────────────────────────────────────
search-factory:
	$(PYTHON) native/search/search_factory.py
search-decorator:
	$(PYTHON) native/search/search_decorator.py
search-langchain:
	$(PYTHON) langchain/search/search_langchain.py

# ── Web Tool ──────────────────────────────────────────────────────────────────
web-factory:
	$(PYTHON) native/web/web_factory.py
web-decorator:
	$(PYTHON) native/web/web_decorator.py
web-langchain:
	$(PYTHON) langchain/web/web_langchain.py

# ── Edit Tool ─────────────────────────────────────────────────────────────────
edit-factory:
	$(PYTHON) native/edit/edit_factory.py
edit-decorator:
	$(PYTHON) native/edit/edit_decorator.py
edit-langchain:
	$(PYTHON) langchain/edit/edit_langchain.py

# ── Extract From File Tool ──────────────────────────────────────────────────────
extract-from-file-factory:
	$(PYTHON) native/extract_from_file/extract_from_file_factory.py
extract-from-file-decorator:
	$(PYTHON) native/extract_from_file/extract_from_file_decorator.py
extract-from-file-langchain:
	$(PYTHON) langchain/extract_from_file/extract_from_file_langchain.py
extract-from-file-crewai:
	$(PYTHON) crewai/extract_from_file/extract_from_file_crewai.py

# ── Convert To File Tool ─────────────────────────────────────────────────────────
convert-to-file-factory:
	$(PYTHON) native/convert_to_file/convert_to_file_factory.py
convert-to-file-decorator:
	$(PYTHON) native/convert_to_file/convert_to_file_decorator.py
convert-to-file-langchain:
	$(PYTHON) langchain/convert_to_file/convert_to_file_langchain.py
convert-to-file-crewai:
	$(PYTHON) crewai/convert_to_file/convert_to_file_crewai.py

# ── Web Scraper Tool ─────────────────────────────────────────────────────────────
web-scraper-factory:
	$(PYTHON) native/web_scraper/web_scraper_factory.py
web-scraper-decorator:
	$(PYTHON) native/web_scraper/web_scraper_decorator.py
web-scraper-langchain:
	$(PYTHON) langchain/web_scraper/web_scraper_langchain.py
web-scraper-crewai:
	$(PYTHON) crewai/web_scraper/web_scraper_crewai.py

# ── MCP ───────────────────────────────────────────────────────────────────────
# MCP Servers
mcp-server-stdio:
	$(PYTHON) mcp/src/server_stdio.py
mcp-server-http:
	$(PYTHON) mcp/src/server_http.py

# MCP Agents (now in organized src/ directory)
mcp-agent-stdio:
	$(PYTHON) mcp/src/agent_stdio.py
mcp-agent-http:
	$(PYTHON) mcp/src/agent_http.py
mcp-agent:
	$(PYTHON) mcp/src/agent.py -- --stdio
mcp-agent-http-mode:
	$(PYTHON) mcp/src/agent.py -- --http
mcp-agent-multi:
	$(PYTHON) mcp/src/agent.py -- --multi

# # MCP Diagnostics & Testing
# mcp-diagnose:
# 	$(PYTHON) mcp/src/diagnose_tools.py
# mcp-test:
# 	cd mcp && $(PYTHON) -m pytest tests/ -v

# ── Advanced Features ─────────────────────────────────────────────────────────
credentials:
	$(PYTHON) native/credentials/credentials_example.py
policy:
	$(PYTHON) native/policy/policy_demo.py
skills:
	$(PYTHON) native/skills/skills_demo.py
meta-flow:
	$(PYTHON) native/meta_flow/meta_tools_integration.py

# ── Advanced Agent ────────────────────────────────────────────────────────────
agent-langchain-skills-policy:
	$(PYTHON) langchain/agents/langchain_skills_policy_agent.py
# ── Bruno CLI API Testing ─────────────────────────────────────────────────────
bruno-complete:
	$(PYTHON) bruno/complete_workflow.py
bruno-crewai:
	$(PYTHON) bruno/crewai_agent.py