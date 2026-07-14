"""Unit tests for the calculator core tool (YAML definition + run() logic).

Mirrors: typescript/packages/core/test/unit/tools/calculator.test.ts
"""
from __future__ import annotations

import importlib.util
import math
import types
from pathlib import Path
from typing import Any

import pytest
import yaml

TOOL_DIR = Path(__file__).parent.parent.parent / "src" / "matimo" / "tools" / "calculator"
DEFINITION_PATH = TOOL_DIR / "definition.yaml"
MODULE_PATH = TOOL_DIR / "calculator.py"


def _load_module() -> types.ModuleType:
    """Import calculator.py directly from disk, mirroring FunctionExecutor's loader."""
    spec = importlib.util.spec_from_file_location("matimo_tool_calculator", MODULE_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def mod() -> types.ModuleType:
    return _load_module()


@pytest.fixture()
def definition() -> dict[str, Any]:
    return yaml.safe_load(DEFINITION_PATH.read_text())  # type: ignore[no-any-return]


# ── YAML definition ──────────────────────────────────────────────────────


class TestDefinition:
    def test_definition_valid(self, definition: dict[str, Any]) -> None:
        assert definition["name"] == "calculator"
        assert definition["version"] == "1.1.0"
        assert "parameters" in definition
        assert definition["execution"]["type"] == "function"
        assert definition["execution"]["code"] == "./calculator.py"

    def test_all_parameters_optional(self, definition: dict[str, Any]) -> None:
        params = definition["parameters"]
        for name in ("operation", "a", "b", "expression", "precision"):
            assert name in params
            assert params[name]["required"] is False

    def test_output_schema_has_expected_fields(self, definition: dict[str, Any]) -> None:
        props = definition["output_schema"]["properties"]
        assert set(props) == {"result", "operation", "original_operation", "operands"}

    def test_examples_present(self, definition: dict[str, Any]) -> None:
        assert len(definition["examples"]) >= 1


# ── Binary mode — backward-compatible core operations ────────────────────


class TestBinaryCoreOperations:
    pytestmark = pytest.mark.asyncio

    async def test_add(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "add", "a": 5, "b": 3})
        assert result["result"] == 8
        assert result["operation"] == "add"
        assert result["original_operation"] == "add"
        assert result["operands"] == {"a": 5.0, "b": 3.0}

    async def test_subtract(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "subtract", "a": 10, "b": 3})
        assert result["result"] == 7

    async def test_multiply(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "multiply", "a": 4, "b": 7})
        assert result["result"] == 28

    async def test_divide(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "divide", "a": 10, "b": 4})
        assert result["result"] == 2.5

    async def test_divide_by_zero_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="[Dd]ivision by zero"):
            await mod.run({"operation": "divide", "a": 1, "b": 0})

    @pytest.mark.parametrize(
        "alias,expected",
        [
            ("addition", "add"),
            ("sum", "add"),
            ("plus", "add"),
            ("+", "add"),
            ("minus", "subtract"),
            ("sub", "subtract"),
            ("-", "subtract"),
            ("times", "multiply"),
            ("product", "multiply"),
            ("x", "multiply"),
            ("*", "multiply"),
            ("division", "divide"),
            ("div", "divide"),
            ("/", "divide"),
        ],
    )
    async def test_operation_aliases_normalize(
        self, mod: types.ModuleType, alias: str, expected: str
    ) -> None:
        result = await mod.run({"operation": alias, "a": 6, "b": 2})
        assert result["operation"] == expected
        assert result["original_operation"] == alias


# ── Binary mode — new operations ──────────────────────────────────────────


class TestBinaryNewOperations:
    pytestmark = pytest.mark.asyncio

    async def test_power(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "power", "a": 2, "b": 10})
        assert result["result"] == 1024

    async def test_power_aliases(self, mod: types.ModuleType) -> None:
        for alias in ("pow", "exponent", "exponentiation", "^", "**"):
            result = await mod.run({"operation": alias, "a": 2, "b": 3})
            assert result["result"] == 8
            assert result["operation"] == "power"

    async def test_modulo(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "modulo", "a": 10, "b": 3})
        assert result["result"] == 1

    async def test_modulo_by_zero_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="[Mm]odulo by zero"):
            await mod.run({"operation": "modulo", "a": 1, "b": 0})

    async def test_modulo_sign_follows_dividend(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "modulo", "a": -7, "b": 3})
        assert result["result"] == pytest.approx(-1.0)

    async def test_sqrt(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "sqrt", "a": 144})
        assert result["result"] == 12
        assert result["operands"] == {"a": 144.0}

    async def test_sqrt_ignores_b(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "sqrt", "a": 16, "b": 999})
        assert result["result"] == 4
        assert "b" not in result["operands"]

    async def test_sqrt_negative_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="negative"):
            await mod.run({"operation": "sqrt", "a": -1})

    async def test_sin(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "sin", "a": 0})
        assert result["result"] == pytest.approx(0.0)

    async def test_cos(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "cos", "a": 0})
        assert result["result"] == pytest.approx(1.0)

    async def test_tan(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "tan", "a": 0})
        assert result["result"] == pytest.approx(0.0)

    async def test_log(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "log", "a": math.e})
        assert result["result"] == pytest.approx(1.0)

    async def test_log_non_positive_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="undefined"):
            await mod.run({"operation": "log", "a": 0})

    async def test_log10(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "log10", "a": 1000})
        assert result["result"] == pytest.approx(3.0)

    async def test_log10_non_positive_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="undefined"):
            await mod.run({"operation": "log10", "a": -5})

    async def test_zero_to_negative_power_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="undefined"):
            await mod.run({"operation": "power", "a": 0, "b": -1})

    async def test_negative_base_fractional_exponent_yields_complex_raises(
        self, mod: types.ModuleType
    ) -> None:
        with pytest.raises(Exception, match="complex"):
            await mod.run({"operation": "power", "a": -8, "b": 0.5})


# ── Binary mode — validation errors ────────────────────────────────────────


class TestBinaryValidationErrors:
    pytestmark = pytest.mark.asyncio

    async def test_missing_a_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="`a`"):
            await mod.run({"operation": "add", "b": 3})

    async def test_non_numeric_a_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="`a`"):
            await mod.run({"operation": "add", "a": "nope", "b": 3})

    async def test_missing_b_for_binary_op_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="`b`"):
            await mod.run({"operation": "add", "a": 1})

    async def test_bool_rejected_as_number(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="`a`"):
            await mod.run({"operation": "add", "a": True, "b": 1})

    async def test_unknown_operation_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="Invalid operation"):
            await mod.run({"operation": "frobnicate", "a": 1, "b": 2})


# ── Expression mode ─────────────────────────────────────────────────────────


class TestExpressionMode:
    pytestmark = pytest.mark.asyncio

    async def test_simple_expression(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "2 + 3 * 4"})
        assert result["result"] == 14
        assert result["operation"] == "expression"
        assert result["original_operation"] == "expression"
        assert result["operands"] == {"expression": "2 + 3 * 4"}

    async def test_expression_with_parentheses(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "(2 + 3) * 4"})
        assert result["result"] == 20

    async def test_expression_with_power_caret(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "2^10"})
        assert result["result"] == 1024

    async def test_expression_with_functions_and_constants(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "sqrt(16) + 2^3 - sin(pi/2)"})
        assert result["result"] == pytest.approx(4 + 8 - 1)

    async def test_expression_with_e_constant(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "log(e)"})
        assert result["result"] == pytest.approx(1.0)

    async def test_expression_too_long_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="maximum length"):
            await mod.run({"expression": "1+" * 300})

    async def test_expression_division_by_zero_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="[Dd]ivision by zero"):
            await mod.run({"expression": "1/0"})

    async def test_expression_invalid_syntax_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="Failed to evaluate"):
            await mod.run({"expression": "2 + )("})

    async def test_expression_domain_error_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="Failed to evaluate"):
            await mod.run({"expression": "sqrt(-1)"})

    async def test_expression_non_numeric_result_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="did not evaluate to a real number"):
            await mod.run({"expression": "'abc'"})

    async def test_expression_int_overflow_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="not a finite number"):
            await mod.run({"expression": "10**400"})

    async def test_expression_float_overflow_is_non_finite(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="not a finite number"):
            await mod.run({"expression": "1e308 * 10"})

    async def test_expression_disallows_arbitrary_names(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="not defined"):
            await mod.run({"expression": "__import__('os')"})

    async def test_expression_no_eval_or_exec_used(self, mod: types.ModuleType) -> None:
        source = MODULE_PATH.read_text()
        assert "\neval(" not in source
        assert "\nexec(" not in source
        assert "= ast.literal_eval(" not in source


# ── Mode validation ─────────────────────────────────────────────────────────


class TestModeValidation:
    pytestmark = pytest.mark.asyncio

    async def test_missing_both_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="Must provide"):
            await mod.run({})

    async def test_expression_and_operation_together_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="not both"):
            await mod.run({"expression": "1+1", "operation": "add", "a": 1, "b": 2})

    async def test_expression_and_bare_operands_together_raises(
        self, mod: types.ModuleType
    ) -> None:
        with pytest.raises(Exception, match="not both"):
            await mod.run({"expression": "1+1", "a": 1})


# ── Precision ────────────────────────────────────────────────────────────────


class TestPrecision:
    pytestmark = pytest.mark.asyncio

    async def test_rounds_binary_result(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "divide", "a": 10, "b": 3, "precision": 2})
        assert result["result"] == 3.33

    async def test_rounds_expression_result(self, mod: types.ModuleType) -> None:
        result = await mod.run({"expression": "10/3", "precision": 4})
        assert result["result"] == pytest.approx(3.3333)

    async def test_omitted_precision_leaves_result_unrounded(
        self, mod: types.ModuleType
    ) -> None:
        result = await mod.run({"operation": "divide", "a": 10, "b": 3})
        assert result["result"] == pytest.approx(10 / 3, rel=0, abs=1e-15)

    async def test_precision_zero_rounds_to_integer(self, mod: types.ModuleType) -> None:
        result = await mod.run({"operation": "divide", "a": 10, "b": 3, "precision": 0})
        assert result["result"] == 3

    @pytest.mark.parametrize("bad", [-1, 16, 1.5])
    async def test_out_of_range_precision_raises(
        self, mod: types.ModuleType, bad: float
    ) -> None:
        with pytest.raises(Exception, match="precision"):
            await mod.run({"operation": "add", "a": 1, "b": 2, "precision": bad})

    async def test_non_numeric_precision_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="precision"):
            await mod.run({"operation": "add", "a": 1, "b": 2, "precision": "two"})

    async def test_bool_precision_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(Exception, match="precision"):
            await mod.run({"operation": "add", "a": 1, "b": 2, "precision": True})
