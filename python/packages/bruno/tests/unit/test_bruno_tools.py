import pytest
from pathlib import Path
import yaml


TOOL_NAMES = [
    'bruno_run_collection',
    'bruno_run_request',
    'bruno_list_collections',
    'bruno_get_collection_info',
    'bruno_import_openapi',
    'bruno_create_collection',
    'bruno_add_request'
]


@pytest.fixture(params=TOOL_NAMES)
def tool_name(request: pytest.FixtureRequest) -> str:
    """Parametrized fixture for all tool names."""
    return request.param


@pytest.fixture
def tool_definition(tool_name: str) -> dict:
    """Load tool definition YAML."""
    tool_path = Path(__file__).parent.parent.parent / "src" / "matimo_bruno" / "tools" / tool_name / "definition.yaml"
    with open(tool_path) as f:
        return yaml.safe_load(f)


def test_tool_definition_valid(tool_name: str, tool_definition: dict) -> None:
    """Test YAML structure is valid."""
    assert tool_definition is not None
    assert tool_definition.get("name") == tool_name
    assert "description" in tool_definition
    assert "version" in tool_definition
    assert tool_definition.get("status") == "stable"
    assert "parameters" in tool_definition
    assert "execution" in tool_definition
    assert "output_schema" in tool_definition


def test_authentication_config(tool_definition: dict) -> None:
    """Test authentication is properly configured."""
    auth = tool_definition.get("authentication")
    assert auth is not None
    assert auth.get("type") in ["api_key", "bearer", "basic", "oauth2"]


def test_examples_present(tool_definition: dict) -> None:
    """Test examples are documented."""
    examples = tool_definition.get("examples", [])
    assert len(examples) >= 1
    assert all("name" in ex and "params" in ex for ex in examples)


def test_execution_config(tool_definition: dict) -> None:
    """Test execution configuration is valid."""
    execution = tool_definition.get("execution")
    assert execution is not None
    assert execution.get("type") in ["command", "function"]
    
    # CLI-based tools use command type
    if execution.get("type") == "command":
        assert execution.get("command") == "bru"
        assert isinstance(execution.get("args"), list)
    
    # Programmatic tools use function type
    if execution.get("type") == "function":
        assert execution.get("function") is not None
