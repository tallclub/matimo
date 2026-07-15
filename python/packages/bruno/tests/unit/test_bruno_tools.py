"""Unit tests for all 7 Bruno tool executors and YAML definitions."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import yaml

# ─── Tool definition paths ───────────────────────────────────────────────────

TOOL_NAMES = [
    "bruno_run_collection",
    "bruno_run_request",
    "bruno_list_collections",
    "bruno_get_collection_info",
    "bruno_import_openapi",
    "bruno_create_collection",
    "bruno_add_request",
]

TOOLS_ROOT = Path(__file__).parent.parent.parent / "src" / "matimo_bruno" / "tools"


@pytest.fixture(params=TOOL_NAMES)
def tool_name(request: pytest.FixtureRequest) -> str:
    return str(request.param)


@pytest.fixture
def tool_definition(tool_name: str) -> dict[str, Any]:
    tool_path = TOOLS_ROOT / tool_name / "definition.yaml"
    with open(tool_path) as f:
        return yaml.safe_load(f)  # type: ignore[return-value]


# ─── YAML Definition Tests ────────────────────────────────────────────────────


def test_tool_definition_valid(tool_name: str, tool_definition: dict[str, Any]) -> None:
    assert tool_definition is not None
    assert tool_definition.get("name") == tool_name
    assert "description" in tool_definition
    assert "version" in tool_definition
    assert tool_definition.get("status") in {"stable", "approved"}
    assert "parameters" in tool_definition
    assert "execution" in tool_definition
    assert "output_schema" in tool_definition


def test_no_api_key_authentication(tool_definition: dict[str, Any]) -> None:
    """CLI tools must not declare api_key authentication."""
    auth = tool_definition.get("authentication")
    assert auth is None, f"Unexpected authentication block found: {auth}"


def test_no_default_retry(tool_definition: dict[str, Any]) -> None:
    """Default retry=0 must not be present (it is the default and adds noise)."""
    error_handling = tool_definition.get("error_handling")
    assert error_handling is None, (
        f"Unexpected error_handling block found: {error_handling}"
    )


def test_examples_present(tool_definition: dict[str, Any]) -> None:
    examples = tool_definition.get("examples", [])
    assert len(examples) >= 1
    assert all("name" in ex and "params" in ex for ex in examples)


def test_execution_type_is_function(tool_definition: dict[str, Any]) -> None:
    execution = tool_definition.get("execution", {})
    assert execution.get("type") == "function"
    assert execution.get("code") == "executor.py"


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _run_ok(stdout: str = "", returncode: int = 0) -> MagicMock:
    m = MagicMock()
    m.returncode = returncode
    m.stdout = stdout
    m.stderr = ""
    return m


def _run_fail(stderr: str = "bru error", returncode: int = 1) -> MagicMock:
    m = MagicMock()
    m.returncode = returncode
    m.stdout = ""
    m.stderr = stderr
    return m


# ─── bruno_create_collection ─────────────────────────────────────────────────


class TestCreateCollection:
    def _exec(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_create_collection.executor import execute
        return execute(params)

    def test_run_entry_point(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_create_collection.executor import run
        result = run({"collection_path": str(tmp_path / "col"), "collection_name": "Test"})
        assert result["success"] is True

    def test_creates_directory_and_bruno_json(self, tmp_path: Path) -> None:
        col_path = tmp_path / "my-api"
        result = self._exec({"collection_path": str(col_path), "collection_name": "My API"})
        assert result["success"] is True
        assert result["errors"] == []
        assert col_path.exists()
        bruno_json = json.loads((col_path / "bruno.json").read_text())
        assert bruno_json["name"] == "My API"
        assert bruno_json["version"] == 1

    def test_existing_directory_ok(self, tmp_path: Path) -> None:
        col_path = tmp_path / "existing"
        col_path.mkdir()
        result = self._exec({"collection_path": str(col_path), "collection_name": "Existing"})
        assert result["success"] is True

    def test_nested_path_created(self, tmp_path: Path) -> None:
        nested = tmp_path / "a" / "b" / "c"
        result = self._exec({"collection_path": str(nested), "collection_name": "Nested"})
        assert result["success"] is True
        assert nested.exists()

    def test_missing_collection_path_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            self._exec({"collection_name": "Test"})

    def test_missing_collection_name_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            self._exec({"collection_path": "/some/path"})

    def test_exception_returns_failure(self, tmp_path: Path) -> None:
        # Pass a path that cannot be created (file exists at that location)
        blocker = tmp_path / "blocker"
        blocker.write_text("I am a file")
        result = self._exec({"collection_path": str(blocker / "nested"), "collection_name": "X"})
        assert result["success"] is False
        assert len(result["errors"]) > 0


# ─── bruno_add_request ───────────────────────────────────────────────────────


class TestAddRequest:
    def _run(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_add_request.executor import run
        return run(params)

    def test_creates_bru_file(self, tmp_path: Path) -> None:
        result = self._run({
            "collection_path": str(tmp_path),
            "request_name": "get-users",
            "method": "GET",
            "url": "https://api.example.com/users",
        })
        assert result["success"] is True
        bru_path = Path(result["request_path"])
        assert bru_path.exists()
        content = bru_path.read_text()
        assert "GET" in content
        assert "https://api.example.com/users" in content

    def test_with_headers(self, tmp_path: Path) -> None:
        result = self._run({
            "collection_path": str(tmp_path),
            "request_name": "auth-request",
            "method": "POST",
            "url": "https://api.example.com/login",
            "headers": {"Authorization": "Bearer token", "Content-Type": "application/json"},
        })
        assert result["success"] is True
        content = Path(result["request_path"]).read_text()
        assert "Authorization" in content

    def test_with_body(self, tmp_path: Path) -> None:
        result = self._run({
            "collection_path": str(tmp_path),
            "request_name": "create-item",
            "method": "POST",
            "url": "https://api.example.com/items",
            "body": '{"name": "widget"}',
        })
        assert result["success"] is True
        content = Path(result["request_path"]).read_text()
        assert "json" in content

    def test_with_tests(self, tmp_path: Path) -> None:
        result = self._run({
            "collection_path": str(tmp_path),
            "request_name": "test-request",
            "method": "GET",
            "url": "https://api.example.com/ping",
            "tests": 'test("ok", function() { expect(res.getStatus()).to.equal(200); });',
        })
        assert result["success"] is True
        content = Path(result["request_path"]).read_text()
        assert "tests" in content

    def test_with_documentation(self, tmp_path: Path) -> None:
        result = self._run({
            "collection_path": str(tmp_path),
            "request_name": "documented",
            "method": "GET",
            "url": "https://example.com",
            "documentation": "This endpoint does something",
        })
        assert result["success"] is True
        content = Path(result["request_path"]).read_text()
        assert "docs" in content

    def test_missing_required_params_returns_failure(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_add_request.executor import bruno_add_request
        result = bruno_add_request(
            collection_path=str(tmp_path),
            request_name="",  # empty → validation catches it
            method="GET",
            url="https://example.com",
        )
        assert result["success"] is False

    def test_exception_returns_failure(self) -> None:
        # Write request to a non-existent read-only path
        result = self._run({
            "collection_path": "",
            "request_name": "fail",
            "method": "GET",
            "url": "https://example.com",
        })
        assert result["success"] is False


# ─── bruno_get_collection_info ───────────────────────────────────────────────


class TestGetCollectionInfo:
    def _exec(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_get_collection_info.executor import execute
        return execute(params)

    def _run(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_get_collection_info.executor import run
        return run(params)

    def test_run_entry_point(self, tmp_path: Path) -> None:
        (tmp_path / "bruno.json").write_text(json.dumps({"name": "MyAPI", "version": 1}))
        result = self._run({"collection_path": str(tmp_path)})
        assert result["success"] is True

    def test_returns_collection_metadata(self, tmp_path: Path) -> None:
        (tmp_path / "bruno.json").write_text(json.dumps({"name": "My API", "version": 1}))
        bru_file = tmp_path / "get-users.bru"
        bru_file.write_text("GET {\n  url: https://example.com\n  body: none\n  auth: inherit\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        assert result["success"] is True
        assert result["collection"]["name"] == "My API"
        assert len(result["collection"]["requests"]) == 1

    def test_detects_post_method(self, tmp_path: Path) -> None:
        (tmp_path / "post-users.bru").write_text("post {\n  url: https://example.com/users\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        reqs = result["collection"]["requests"]
        methods = {r["method"] for r in reqs}
        assert "POST" in methods

    def test_detects_put_method(self, tmp_path: Path) -> None:
        (tmp_path / "put-user.bru").write_text("put {\n  url: https://example.com/users/1\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        methods = {r["method"] for r in result["collection"]["requests"]}
        assert "PUT" in methods

    def test_detects_delete_method(self, tmp_path: Path) -> None:
        (tmp_path / "del-user.bru").write_text("delete {\n  url: https://example.com/users/1\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        methods = {r["method"] for r in result["collection"]["requests"]}
        assert "DELETE" in methods

    def test_detects_patch_method(self, tmp_path: Path) -> None:
        (tmp_path / "patch-user.bru").write_text("patch {\n  url: https://example.com/users/1\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        methods = {r["method"] for r in result["collection"]["requests"]}
        assert "PATCH" in methods

    def test_missing_collection_path_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            self._exec({})

    def test_nonexistent_path_returns_failure(self) -> None:
        result = self._exec({"collection_path": "/nonexistent/path"})
        assert result["success"] is False
        assert len(result["errors"]) > 0

    def test_no_bruno_json_still_works(self, tmp_path: Path) -> None:
        (tmp_path / "req.bru").write_text("GET {\n  url: https://example.com\n}")
        result = self._exec({"collection_path": str(tmp_path)})
        assert result["success"] is True
        assert result["collection"]["name"] == tmp_path.name

    def test_invalid_bruno_json_handled(self, tmp_path: Path) -> None:
        (tmp_path / "bruno.json").write_text("NOT JSON {{{{")
        result = self._exec({"collection_path": str(tmp_path)})
        assert result["success"] is True  # gracefully recovers

    def test_exception_returns_failure(self) -> None:
        from matimo_bruno.tools.bruno_get_collection_info import executor
        with patch.object(executor, "Path", side_effect=Exception("boom")):
            result = executor.execute({"collection_path": "/some/path"})
        assert result["success"] is False


# ─── bruno_list_collections ──────────────────────────────────────────────────


class TestListCollections:
    def _exec(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_list_collections.executor import execute
        return execute(params)

    def _run(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_list_collections.executor import run
        return run(params)

    def _make_collection(self, parent: Path, name: str) -> Path:
        col = parent / name
        col.mkdir()
        (col / "bruno.json").write_text(json.dumps({"name": name, "version": 1}))
        return col

    def test_run_entry_point(self, tmp_path: Path) -> None:
        self._make_collection(tmp_path, "api-a")
        result = self._run({"workspace_path": str(tmp_path)})
        assert result["success"] is True

    def test_lists_all_collections(self, tmp_path: Path) -> None:
        self._make_collection(tmp_path, "api-a")
        self._make_collection(tmp_path, "api-b")
        result = self._exec({"workspace_path": str(tmp_path)})
        assert result["success"] is True
        assert len(result["collections"]) == 2

    def test_filter_by_name(self, tmp_path: Path) -> None:
        self._make_collection(tmp_path, "payment-api")
        self._make_collection(tmp_path, "user-service")
        result = self._exec({"workspace_path": str(tmp_path), "filter": "payment"})
        assert result["success"] is True
        assert len(result["collections"]) == 1
        assert result["collections"][0]["name"] == "payment-api"

    def test_filter_by_path(self, tmp_path: Path) -> None:
        nested = tmp_path / "subdir"
        nested.mkdir()
        self._make_collection(nested, "sub-collection")
        self._make_collection(tmp_path, "root-collection")
        result = self._exec({"workspace_path": str(tmp_path), "filter": "subdir"})
        assert result["success"] is True
        assert len(result["collections"]) == 1

    def test_nonexistent_workspace_returns_empty(self) -> None:
        result = self._exec({"workspace_path": "/nonexistent/workspace"})
        assert result["success"] is True
        assert result["collections"] == []

    def test_missing_workspace_path_raises(self) -> None:
        with pytest.raises(ValueError, match="required"):
            self._exec({})

    def test_invalid_bruno_json_skipped(self, tmp_path: Path) -> None:
        bad_col = tmp_path / "bad"
        bad_col.mkdir()
        (bad_col / "bruno.json").write_text("NOT JSON {{{{")
        good_col = self._make_collection(tmp_path, "good-col")
        _ = good_col
        result = self._exec({"workspace_path": str(tmp_path)})
        assert result["success"] is True
        # bad collection is skipped, good one appears
        assert len(result["collections"]) == 1

    def test_exception_returns_failure(self) -> None:
        from matimo_bruno.tools.bruno_list_collections import executor
        with patch.object(executor, "Path", side_effect=Exception("disk error")):
            result = executor.execute({"workspace_path": "/some/path"})
        assert result["success"] is False


# ─── bruno_run_collection ────────────────────────────────────────────────────


class TestRunCollection:
    def _exec(self, params: dict[str, Any], bru_result: MagicMock | None = None) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        mock = bru_result or _run_ok()
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=mock):
            return execute(params)

    def _run(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_run_collection.executor import run
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok()):
            return run(params)

    def test_run_entry_point(self, tmp_path: Path) -> None:
        result = self._run({"collection_path": str(tmp_path)})
        assert result["success"] is True

    def test_success(self, tmp_path: Path) -> None:
        result = self._exec({"collection_path": str(tmp_path)})
        assert result["success"] is True
        assert result["errors"] == []

    def test_missing_collection_path_raises(self) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"):
            with pytest.raises(ValueError, match="required"):
                execute({})

    def test_nonexistent_collection_returns_failure(self) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="3.1.3")):
            result = execute({"collection_path": "/nonexistent/collection"})
        assert result["success"] is False

    def test_bru_not_installed_raises(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        with patch("shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="Bruno CLI"):
                execute({"collection_path": str(tmp_path)})

    def test_subprocess_failure(self, tmp_path: Path) -> None:
        result = self._exec({"collection_path": str(tmp_path)}, _run_fail("bru: error"))
        assert result["success"] is False
        assert "bru: error" in result["errors"]

    def test_subprocess_failure_empty_stderr(self, tmp_path: Path) -> None:
        fail = _run_fail(stderr="")
        result = self._exec({"collection_path": str(tmp_path)}, fail)
        assert result["success"] is False

    def test_optional_params_passed_to_bru(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        captured: list[list[str]] = []
        def fake_run(args: list[str], **kwargs: Any) -> MagicMock:  # noqa: ANN401
            captured.append(args)
            return _run_ok()
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=fake_run):
            execute({
                "collection_path": str(tmp_path),
                "tags": "smoke",
                "exclude_tags": "slow",
                "tests_only": True,
                "bail_on_failure": True,
                "parallel": True,
            })
        # captured[0] is the bru --version check; captured[1] is the actual bru run
        run_args = captured[1]
        assert "--tags" in run_args
        assert "smoke" in run_args
        assert "--exclude-tags" in run_args
        assert "--tests-only" in run_args
        assert "--bail" in run_args
        assert "--parallel" in run_args

    def test_timeout_returns_failure(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=subprocess.TimeoutExpired("bru", 300)):
            result = execute({"collection_path": str(tmp_path)})
        assert result["success"] is False
        assert any("timed out" in e.lower() for e in result["errors"])

    def test_exception_returns_failure(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_collection.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=Exception("unexpected")):
            result = execute({"collection_path": str(tmp_path)})
        assert result["success"] is False


# ─── bruno_run_request ───────────────────────────────────────────────────────


class TestRunRequest:
    def _exec(self, params: dict[str, Any], bru_result: MagicMock | None = None,
              collection_path: Path | None = None) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_run_request.executor import execute
        mock = bru_result or _run_ok()
        col_path = collection_path
        if col_path is not None:
            params = {**params, "collection_path": str(col_path)}
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=mock):
            return execute(params)

    def _make_bru_file(self, col_path: Path, name: str) -> Path:
        bru = col_path / f"{name}.bru"
        bru.write_text("GET {\n  url: https://example.com\n}")
        return bru

    def test_run_entry_point(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_request.executor import run
        self._make_bru_file(tmp_path, "my-request")
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok()):
            result = run({"collection_path": str(tmp_path), "request_name": "my-request"})
        assert result["success"] is True

    def test_success_with_root_bru_file(self, tmp_path: Path) -> None:
        self._make_bru_file(tmp_path, "ping")
        result = self._exec({"request_name": "ping"}, collection_path=tmp_path)
        assert result["success"] is True

    def test_success_with_requests_subdir(self, tmp_path: Path) -> None:
        requests_dir = tmp_path / "requests"
        requests_dir.mkdir()
        (requests_dir / "login.bru").write_text("GET {\n  url: https://example.com\n}")
        result = self._exec({"request_name": "login"}, collection_path=tmp_path)
        assert result["success"] is True

    def test_missing_params_raises(self) -> None:
        from matimo_bruno.tools.bruno_run_request.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"):
            with pytest.raises(ValueError, match="required"):
                execute({"collection_path": "/some/path"})

    def test_nonexistent_collection_returns_failure(self) -> None:
        from matimo_bruno.tools.bruno_run_request.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="3.1.3")):
            result = execute({"collection_path": "/nonexistent", "request_name": "test"})
        assert result["success"] is False

    def test_request_file_not_found_returns_failure(self, tmp_path: Path) -> None:
        result = self._exec({"request_name": "missing"}, collection_path=tmp_path)
        assert result["success"] is False
        assert any("not found" in e.lower() for e in result["errors"])

    def test_bru_not_installed_raises(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_run_request.executor import execute
        with patch("shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="Bruno CLI"):
                execute({"collection_path": str(tmp_path), "request_name": "x"})

    def test_subprocess_failure(self, tmp_path: Path) -> None:
        self._make_bru_file(tmp_path, "fail-req")
        result = self._exec({"request_name": "fail-req"}, _run_fail("connection refused"),
                            collection_path=tmp_path)
        assert result["success"] is False
        assert "connection refused" in result["errors"]

    def test_subprocess_failure_empty_stderr(self, tmp_path: Path) -> None:
        self._make_bru_file(tmp_path, "fail-req")
        fail = MagicMock()
        fail.returncode = 1
        fail.stdout = ""
        fail.stderr = ""
        result = self._exec({"request_name": "fail-req"}, fail, collection_path=tmp_path)
        assert result["success"] is False

    def test_exception_returns_failure(self, tmp_path: Path) -> None:
        self._make_bru_file(tmp_path, "err-req")
        from matimo_bruno.tools.bruno_run_request.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=Exception("disk error")):
            result = execute({"collection_path": str(tmp_path), "request_name": "err-req"})
        assert result["success"] is False


# ─── bruno_import_openapi ────────────────────────────────────────────────────


class TestImportOpenAPI:
    def _exec(self, params: dict[str, Any], bru_result: MagicMock | None = None) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_import_openapi.executor import execute
        mock = bru_result or _run_ok()
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=mock):
            return execute(params)

    def _run(self, params: dict[str, Any]) -> dict[str, Any]:
        from matimo_bruno.tools.bruno_import_openapi.executor import run
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok()):
            return run(params)

    def test_run_entry_point(self, tmp_path: Path) -> None:
        result = self._run({"spec_source": "./spec.yaml", "output_directory": str(tmp_path)})
        assert result["success"] is True

    def test_success(self, tmp_path: Path) -> None:
        result = self._exec({
            "spec_source": "./openapi.yaml",
            "output_directory": str(tmp_path),
        })
        assert result["success"] is True
        assert result["errors"] == []
        assert result["collection_name"] == "Imported Collection"

    def test_custom_collection_name(self, tmp_path: Path) -> None:
        result = self._exec({
            "spec_source": "./spec.yaml",
            "output_directory": str(tmp_path),
            "collection_name": "My API",
        })
        assert result["success"] is True
        assert result["collection_name"] == "My API"

    def test_missing_required_params_raises(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_import_openapi.executor import execute
        with pytest.raises(ValueError, match="required"):
            execute({"spec_source": "./spec.yaml"})

    def test_subprocess_failure(self, tmp_path: Path) -> None:
        result = self._exec(
            {"spec_source": "./spec.yaml", "output_directory": str(tmp_path)},
            _run_fail("invalid spec"),
        )
        assert result["success"] is False
        assert "invalid spec" in result["errors"]

    def test_timeout_returns_failure(self, tmp_path: Path) -> None:
        from matimo_bruno.tools.bruno_import_openapi.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=subprocess.TimeoutExpired("bru", 60)):
            result = execute({"spec_source": "./spec.yaml", "output_directory": str(tmp_path)})
        assert result["success"] is False
        assert any("timed out" in e.lower() for e in result["errors"])

    def test_exception_returns_failure(self) -> None:
        from matimo_bruno.tools.bruno_import_openapi.executor import execute
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=Exception("network error")):
            result = execute({"spec_source": "./spec.yaml", "output_directory": str(Path("."))})
        assert result["success"] is False


# ─── __init__.py ─────────────────────────────────────────────────────────────


def test_get_tools_path_returns_valid_directory() -> None:
    from matimo_bruno import get_tools_path
    tools_path = get_tools_path()
    assert Path(tools_path).is_dir()
    assert "tools" in tools_path


# ─── Extra branch coverage ────────────────────────────────────────────────────


def test_add_request_exception_on_write(tmp_path: Path) -> None:
    """Force a write error to cover the except branch in bruno_add_request."""
    from matimo_bruno.tools.bruno_add_request.executor import bruno_add_request
    # Point to a path where we can't write (file exists at directory location)
    blocker = tmp_path / "requests"
    blocker.write_text("I am a file, not a directory")
    result = bruno_add_request(
        collection_path=str(tmp_path),
        request_name="my-req",
        method="GET",
        url="https://example.com",
    )
    assert result["success"] is False
    assert "Failed to add request" in result["message"]


def test_get_collection_info_unparseable_bru_file(tmp_path: Path) -> None:
    """A bru file that raises during read should be silently skipped."""
    from matimo_bruno.tools.bruno_get_collection_info import executor
    bru = tmp_path / "bad.bru"
    bru.write_text("GET {\n  url: https://example.com\n}")
    # Patch Path.read_text to raise for .bru files
    original_read_text = Path.read_text
    def patched_read_text(self: Path, *args: object, **kwargs: object) -> str:
        if self.suffix == ".bru":
            raise OSError("permission denied")
        return original_read_text(self, *args, **kwargs)
    with patch.object(Path, "read_text", patched_read_text):
        result = executor.execute({"collection_path": str(tmp_path)})
    assert result["success"] is True
    assert result["collection"]["requests"] == []


# ─── check_bru_version ───────────────────────────────────────────────────────


class TestBruUtils:
    """Tests for the shared _bru_utils.check_bru_version() function."""

    def _check(self) -> None:  # convenience import
        from matimo_bruno._bru_utils import check_bru_version
        check_bru_version()

    def test_passes_when_version_meets_minimum(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="3.1.3")):
            self._check()  # must not raise

    def test_passes_for_exactly_minimum_version(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="1.0.0")):
            self._check()

    def test_raises_when_version_below_minimum(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="0.9.0")):
            with pytest.raises(RuntimeError, match="below.*minimum"):
                self._check()

    def test_error_message_includes_versions(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="0.8.2")):
            with pytest.raises(RuntimeError) as exc_info:
                self._check()
        assert "0.8.2" in str(exc_info.value)
        assert "1.0.0" in str(exc_info.value)

    def test_raises_when_not_installed(self) -> None:
        with patch("shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="Bruno CLI"):
                self._check()

    def test_error_message_includes_install_hint(self) -> None:
        with patch("shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="npm install"):
                self._check()

    def test_skips_check_when_version_unparseable(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", return_value=_run_ok(stdout="unknown format")):
            self._check()  # must not raise

    def test_skips_check_on_subprocess_timeout(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=subprocess.TimeoutExpired("bru", 5)):
            self._check()  # must not raise — best-effort

    def test_skips_check_on_unexpected_subprocess_error(self) -> None:
        with patch("shutil.which", return_value="/usr/bin/bru"), \
             patch("subprocess.run", side_effect=OSError("permission denied")):
            self._check()  # must not raise — best-effort

