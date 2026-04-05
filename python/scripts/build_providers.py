"""Build all 8 provider packages for the Matimo Python SDK."""
import os
import shutil
from pathlib import Path

BASE = Path(__file__).parent.parent
TS_PACKAGES = BASE.parent / "packages"

PROVIDERS = {
    "slack":     ("Matimo provider — Slack tools (send messages, manage channels, users)", ""),
    "github":    ("Matimo provider — GitHub tools (repos, issues, PRs, releases)", ""),
    "gmail":     ("Matimo provider — Gmail tools (send, list, read, delete emails)", ""),
    "hubspot":   ("Matimo provider — HubSpot CRM tools (contacts, deals, companies, tickets)", ""),
    "notion":    ("Matimo provider — Notion tools (pages, databases, comments)", ""),
    "postgres":  ("Matimo provider — PostgreSQL tools (execute SQL)", "asyncpg>=0.29"),
    "mailchimp": ("Matimo provider — Mailchimp tools (campaigns, lists, members)", ""),
    "twilio":    ("Matimo provider — Twilio tools (SMS, MMS, message history)", "twilio>=8.0"),
}

for provider, (desc, extra_dep) in PROVIDERS.items():
    pkg_dir = BASE / "providers" / f"matimo-{provider}"
    src_dir = pkg_dir / "src" / f"matimo_{provider}"
    tools_dir = src_dir / "tools"
    tools_dir.mkdir(parents=True, exist_ok=True)

    # Copy YAML tools from TS packages
    ts_tools = TS_PACKAGES / provider / "tools"
    copied = 0
    if ts_tools.exists():
        for tool_path in ts_tools.iterdir():
            if tool_path.is_dir():
                yaml_src = tool_path / "definition.yaml"
                if yaml_src.exists():
                    dest = tools_dir / tool_path.name
                    dest.mkdir(exist_ok=True)
                    shutil.copy(yaml_src, dest / "definition.yaml")
                    copied += 1
    print(f"  {provider}: copied {copied} tool YAMLs")

    # pyproject.toml
    extra_deps_line = f'\n    "{extra_dep}",' if extra_dep else ""
    (pkg_dir / "pyproject.toml").write_text(
        f'[build-system]\n'
        f'requires = ["hatchling"]\n'
        f'build-backend = "hatchling.build"\n\n'
        f'[project]\n'
        f'name = "matimo-{provider}"\n'
        f'version = "0.1.0"\n'
        f'description = "{desc}"\n'
        f'readme = "README.md"\n'
        f'license = {{ text = "MIT" }}\n'
        f'requires-python = ">=3.11"\n'
        f'keywords = ["ai", "tools", "agents", "matimo", "{provider}"]\n'
        f'classifiers = [\n'
        f'    "Development Status :: 4 - Beta",\n'
        f'    "Intended Audience :: Developers",\n'
        f'    "License :: OSI Approved :: MIT License",\n'
        f'    "Programming Language :: Python :: 3.11",\n'
        f']\n'
        f'dependencies = [\n'
        f'    "matimo>=0.1.0",{extra_deps_line}\n'
        f']\n\n'
        f'[project.entry-points."matimo.providers"]\n'
        f'{provider} = "matimo_{provider}:get_tools_path"\n\n'
        f'[tool.hatch.build.targets.wheel]\n'
        f'packages = ["src/matimo_{provider}"]\n'
    )

    # __init__.py
    (src_dir / "__init__.py").write_text(
        f'"""Matimo {provider} provider — exposes the path to YAML tool definitions."""\n'
        f'from __future__ import annotations\n\n'
        f'import importlib.resources\n'
        f'from pathlib import Path\n\n\n'
        f'def get_tools_path() -> str:\n'
        f'    """Return the absolute path to the bundled {provider} tool definitions."""\n'
        f'    try:\n'
        f'        ref = importlib.resources.files("matimo_{provider}") / "tools"\n'
        f'        return str(ref)\n'
        f'    except Exception:\n'
        f'        return str(Path(__file__).parent / "tools")\n\n\n'
        f'__all__ = ["get_tools_path"]\n'
    )

    # Package-level README
    (pkg_dir / "README.md").write_text(
        f'# matimo-{provider}\n\n'
        f'Matimo provider package for **{provider}**. '
        f'Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).\n\n'
        f'## Installation\n\n'
        f'```bash\npip install matimo matimo-{provider}\n```\n\n'
        f'## Usage\n\n'
        f'```python\nfrom matimo import Matimo\nfrom matimo_{provider} import get_tools_path\n\n'
        f'matimo = await Matimo.init(get_tools_path())\n```\n'
    )

    print(f"  Built matimo-{provider} OK")

print("\nAll providers built.")
