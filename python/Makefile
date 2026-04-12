# ============================================================================
#  Matimo Python SDK — Workspace Makefile
#  mirrors: typescript/package.json scripts
#
#  Usage:  make <target>
#  List:   make help
# ============================================================================

.DEFAULT_GOAL := help

# ── Paths ────────────────────────────────────────────────────────────────────
CORE      := packages/core
CLI       := packages/cli
SCRIPTS   := scripts

# ── Run helpers ──────────────────────────────────────────────────────────────
# All commands run through `uv run` so the workspace virtualenv is always used.
UV        := uv
UV_RUN    := uv run
UV_TOOL   := uv tool run

.PHONY: help install sync build clean \
        test test-watch test-coverage test-unit test-integration \
        lint lint-fix format format-check \
        typecheck validate-tools \
        policy-demo skills-demo meta-flow logger-example \
        dev

# ── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Matimo Python SDK"
	@echo "════════════════════════════════════════════"
	@echo ""
	@echo "  Setup"
	@echo "  ──────────────────────────────────────────"
	@echo "  make install          Install all deps (alias: sync)"
	@echo "  make sync             uv sync --all-extras --dev"
	@echo ""
	@echo "  Build"
	@echo "  ──────────────────────────────────────────"
	@echo "  make build            Build all provider packages"
	@echo "  make clean            Remove build artefacts and __pycache__"
	@echo ""
	@echo "  Test"
	@echo "  ──────────────────────────────────────────"
	@echo "  make test             Run full test suite"
	@echo "  make test-unit        Unit tests only"
	@echo "  make test-integration Integration tests only"
	@echo "  make test-watch       Re-run tests on file change (ptw)"
	@echo "  make test-coverage    Run tests with HTML coverage report"
	@echo ""
	@echo "  Code quality"
	@echo "  ──────────────────────────────────────────"
	@echo "  make lint             Ruff check (read-only)"
	@echo "  make lint-fix         Ruff check --fix"
	@echo "  make format           Ruff format (write)"
	@echo "  make format-check     Ruff format --check (CI)"
	@echo "  make typecheck        mypy strict on packages/core/src"
	@echo ""
	@echo "  Tools"
	@echo "  ──────────────────────────────────────────"
	@echo "  make validate-tools   Validate all YAML tool definitions"
	@echo "  make dev              Run core SDK in dev mode"
	@echo ""
	@echo "  Native Examples (requires OPENAI_API_KEY for agent demos)"
	@echo "  ──────────────────────────────────────────"
	@echo "  make policy-demo      Run policy + HITL demo (LangChain agent)"
	@echo "  make skills-demo      Run skills lifecycle demo (LangChain agent)"
	@echo "  make meta-flow        Run meta-tools integration demo (LangChain agent)"
	@echo "  make logger-example   Run structured logger example (no API key needed)"
	@echo ""

# ── Install ──────────────────────────────────────────────────────────────────
install: sync

sync:
	$(UV) sync --all-extras --dev
# ── Build ────────────────────────────────────────────────────────────────────
build:
	$(UV_RUN) python $(SCRIPTS)/build_providers.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name "*.egg-info"  -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name "dist"        -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null; true
	find . -type d -name "htmlcov"     -exec rm -rf {} + 2>/dev/null; true
	find . -name "*.pyc"               -delete 2>/dev/null; true
	find . -name ".coverage"           -delete 2>/dev/null; true
	@echo "Clean complete."

# ── Test ─────────────────────────────────────────────────────────────────────
test:
	$(UV_RUN) pytest $(CORE)/tests/ -v

test-unit:
	$(UV_RUN) pytest $(CORE)/tests/unit/ -v

test-integration:
	$(UV_RUN) pytest $(CORE)/tests/integration/ -v

test-watch:
	$(UV_RUN) ptw $(CORE)/tests/ --runner "uv run pytest"

test-coverage:
	$(UV_RUN) pytest $(CORE)/tests/ \
		--cov=$(CORE)/src/matimo \
		--cov-report=term-missing \
		--cov-report=html:htmlcov \
		-v
	@echo "HTML report: htmlcov/index.html"

# ── Lint & Format ────────────────────────────────────────────────────────────
lint:
	$(UV_RUN) ruff check packages/ scripts/

lint-fix:
	$(UV_RUN) ruff check --fix packages/ scripts/

format:
	$(UV_RUN) ruff format packages/ scripts/

format-check:
	$(UV_RUN) ruff format --check packages/ scripts/

# ── Type checking ─────────────────────────────────────────────────────────────
# mypy is a dev dep of packages/core — run it from there so it can find all stubs.
typecheck:
	cd $(CORE) && $(UV_RUN) mypy src/

# ── Tool validation ───────────────────────────────────────────────────────────
validate-tools:
	$(UV_RUN) python $(SCRIPTS)/validate_tools.py

# ── Dev ───────────────────────────────────────────────────────────────────────
dev:
	$(UV_RUN) python -c "import matimo; print('matimo', matimo.__version__ if hasattr(matimo,'__version__') else 'loaded OK')"
# ── Native Examples ───────────────────────────────────────────────────────────
EXAMPLES := examples/native

policy-demo:
		cd $(EXAMPLES) && $(UV_RUN) -w ../.. python policy/policy_demo.py

skills-demo:
		cd $(EXAMPLES) && $(UV_RUN) -w ../.. python skills/skills_demo.py

meta-flow:
		cd $(EXAMPLES) && $(UV_RUN) -w ../.. python meta_flow/meta_tools_integration.py

logger-example:
		cd $(EXAMPLES) && $(UV_RUN) -w ../.. python logger_example.py