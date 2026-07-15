"""Calculator tool — arithmetic operations and expression evaluation.

Two mutually exclusive modes:
  1. Binary/unary mode: {"operation": ..., "a": ..., "b": ...} — add/subtract/multiply/divide/
     power/modulo (binary) or sqrt/sin/cos/tan/log/log10 (unary, `b` ignored).
  2. Expression mode: {"expression": "..."} — a full math expression string, e.g.
     "sqrt(16) + 2^3 - sin(pi/2)".

Security: expression mode is evaluated with `simpleeval`, restricted to a whitelist of
arithmetic operators (+, -, *, /, **, %, unary +/-) and a whitelist of math functions —
never `eval`/`exec`/`ast.literal_eval`. A fresh evaluator instance (with a fresh names/
functions mapping) is created per call; nothing is reused or mutated across invocations.
Expressions are capped at MAX_EXPRESSION_LENGTH characters.
"""
from __future__ import annotations

import ast
import math
from typing import Any

from simpleeval import DEFAULT_OPERATORS, SimpleEval

MAX_EXPRESSION_LENGTH = 500
MIN_PRECISION = 0
MAX_PRECISION = 15

OPERATION_MAP = {
    # Addition
    "add": "add", "addition": "add", "sum": "add", "plus": "add", "+": "add",
    # Subtraction
    "subtract": "subtract", "subtraction": "subtract", "minus": "subtract",
    "sub": "subtract", "-": "subtract",
    # Multiplication
    "multiply": "multiply", "multiplication": "multiply", "times": "multiply",
    "product": "multiply", "mul": "multiply", "*": "multiply", "x": "multiply",
    # Division
    "divide": "divide", "division": "divide", "div": "divide", "/": "divide",
    # Power
    "power": "power", "pow": "power", "exponent": "power", "exponentiation": "power",
    "^": "power", "**": "power",
    # Square root
    "sqrt": "sqrt", "square root": "sqrt", "square_root": "sqrt",
    # Modulo
    "modulo": "modulo", "mod": "modulo", "remainder": "modulo", "%": "modulo",
    # Trigonometric
    "sin": "sin", "sine": "sin",
    "cos": "cos", "cosine": "cos",
    "tan": "tan", "tangent": "tan",
    # Logarithm
    "log": "log", "ln": "log", "natural log": "log",
    "log10": "log10", "log base 10": "log10",
}

# Binary operations that require both `a` and `b`.
BINARY_OPERATIONS = {"add", "subtract", "multiply", "divide", "power", "modulo"}

# Unary operations that only use `a`; `b` is optional/ignored.
UNARY_OPERATIONS = {"sqrt", "sin", "cos", "tan", "log", "log10"}

VALID_OPERATIONS = sorted(BINARY_OPERATIONS | UNARY_OPERATIONS)

# Restricted operator whitelist for expression mode: plain arithmetic only —
# no comparisons, booleans, bitwise ops, or membership tests.
_ALLOWED_AST_OPERATORS = (
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.USub, ast.UAdd,
)

_EXPRESSION_FUNCTIONS = {
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "pow": math.pow,
    "abs": abs,
}

_EXPRESSION_NAMES = {
    "pi": math.pi,
    "e": math.e,
}


class CalculatorError(ValueError):
    """Raised for invalid parameters or domain errors in the calculator tool."""


def _normalize_operation(op: str) -> str:
    normalized = op.lower().strip()
    return OPERATION_MAP.get(normalized, normalized)


def _validate_precision(precision: object) -> int | None:
    """Validate the `precision` parameter. Returns None when not supplied (no rounding)."""
    if precision is None:
        return None
    if isinstance(precision, bool) or not isinstance(precision, (int, float)):
        raise CalculatorError(
            f"Parameter `precision` must be an integer between {MIN_PRECISION} and {MAX_PRECISION}"
        )
    if isinstance(precision, float) and not precision.is_integer():
        raise CalculatorError(
            f"Parameter `precision` must be an integer between {MIN_PRECISION} and {MAX_PRECISION}"
        )
    value = int(precision)
    if value < MIN_PRECISION or value > MAX_PRECISION:
        raise CalculatorError(
            f"Parameter `precision` must be an integer between {MIN_PRECISION} and {MAX_PRECISION}"
        )
    return value


def _apply_precision(value: float, precision: int | None) -> float:
    if precision is None:
        return value
    return round(value, precision)


def _assert_finite(value: float, message: str = "Result is not a finite number") -> None:
    if math.isnan(value) or math.isinf(value):
        raise CalculatorError(
            f"{message} (division by zero, overflow, or an invalid domain)"
        )


def _evaluate_expression(expression: str, precision: int | None) -> dict[str, Any]:
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise CalculatorError(
            f"Expression exceeds maximum length of {MAX_EXPRESSION_LENGTH} characters"
        )

    # mathjs-style `^` power syntax → Python `**`. Safe: this only rewrites a single
    # character token before parsing, it does not build an eval()-able code string.
    normalized_expression = expression.replace("^", "**")

    allowed_operators = {op: DEFAULT_OPERATORS[op] for op in _ALLOWED_AST_OPERATORS}
    # Fresh evaluator + fresh names/functions mappings per call — never reused or
    # mutated across invocations.
    evaluator = SimpleEval(
        operators=allowed_operators,
        functions=dict(_EXPRESSION_FUNCTIONS),
        names=dict(_EXPRESSION_NAMES),
    )

    try:
        raw_result = evaluator.eval(normalized_expression)
    except CalculatorError:
        raise
    except ZeroDivisionError as exc:
        raise CalculatorError("Division by zero") from exc
    except ValueError as exc:
        raise CalculatorError(f"Failed to evaluate expression: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 - surface any parser/eval failure clearly
        raise CalculatorError(f"Failed to evaluate expression: {exc}") from exc

    if isinstance(raw_result, bool) or not isinstance(raw_result, (int, float)):
        raise CalculatorError(
            "Expression did not evaluate to a real number "
            f"(got {type(raw_result).__name__})"
        )

    try:
        result = float(raw_result)
    except OverflowError as exc:
        raise CalculatorError(
            f"Expression result is not a finite number: {exc}"
        ) from exc
    _assert_finite(result, "Expression result is not a finite number")
    result = _apply_precision(result, precision)

    return {
        "result": result,
        "operation": "expression",
        "original_operation": "expression",
        "operands": {"expression": expression},
    }


def _evaluate_binary(
    operation_input: str,
    a: object,
    b: object,
    precision: int | None,
) -> dict[str, Any]:
    if a is None or isinstance(a, bool) or not isinstance(a, (int, float)):
        raise CalculatorError("Parameter `a` must be a number")
    a_val = float(a)

    normalized_op = _normalize_operation(operation_input)
    is_unary = normalized_op in UNARY_OPERATIONS
    is_binary = normalized_op in BINARY_OPERATIONS

    if not is_unary and not is_binary:
        raise CalculatorError(
            f"Invalid operation: '{operation_input}' (normalized: '{normalized_op}'). "
            f"Valid operations: {', '.join(VALID_OPERATIONS)}"
        )

    b_val: float | None = None
    if is_binary:
        if b is None or isinstance(b, bool) or not isinstance(b, (int, float)):
            raise CalculatorError(
                f"Parameter `b` is required and must be a number for operation `{normalized_op}`"
            )
        b_val = float(b)

    # `b_num` is only read from branches gated on `is_binary` (which guarantees `b_val`
    # was set above); the 0.0 fallback is never actually used by unary branches.
    b_num: float = b_val if b_val is not None else 0.0

    try:
        result: Any
        if normalized_op == "add":
            result = a_val + b_num
        elif normalized_op == "subtract":
            result = a_val - b_num
        elif normalized_op == "multiply":
            result = a_val * b_num
        elif normalized_op == "divide":
            if b_num == 0:
                raise CalculatorError("Division by zero")
            result = a_val / b_num
        elif normalized_op == "power":
            # Use the `**` operator (not math.pow) so 0**negative raises ZeroDivisionError
            # and a negative base with a fractional exponent yields complex rather than
            # a domain ValueError — both are normalized into a clear CalculatorError below.
            result = a_val**b_num
        elif normalized_op == "modulo":
            if b_num == 0:
                raise CalculatorError("Modulo by zero")
            # math.fmod (not `%`) to match JS/TS modulo semantics: the sign of the
            # result follows the dividend, not the divisor.
            result = math.fmod(a_val, b_num)
        elif normalized_op == "sqrt":
            if a_val < 0:
                raise CalculatorError("Cannot compute the square root of a negative number")
            result = math.sqrt(a_val)
        elif normalized_op == "sin":
            result = math.sin(a_val)
        elif normalized_op == "cos":
            result = math.cos(a_val)
        elif normalized_op == "tan":
            result = math.tan(a_val)
        elif normalized_op == "log":
            if a_val <= 0:
                raise CalculatorError("Logarithm is undefined for non-positive numbers")
            result = math.log(a_val)
        elif normalized_op == "log10":
            if a_val <= 0:
                raise CalculatorError("Logarithm is undefined for non-positive numbers")
            result = math.log10(a_val)
        else:  # pragma: no cover - unreachable, guarded above
            raise CalculatorError(f"Unknown operation: {operation_input}")
    except CalculatorError:
        raise
    except ZeroDivisionError as exc:
        raise CalculatorError(f"Result is undefined for these operands: {exc}") from exc
    except (ValueError, OverflowError) as exc:
        raise CalculatorError(f"Result is undefined for these operands: {exc}") from exc

    if isinstance(result, complex):
        raise CalculatorError(
            "Result is not a real number (the operation produced a complex value)"
        )

    result = float(result)
    _assert_finite(result)
    result = _apply_precision(result, precision)

    operands: dict[str, Any] = {"a": a_val} if is_unary else {"a": a_val, "b": b_val}

    return {
        "result": result,
        "operation": normalized_op,
        "original_operation": operation_input,
        "operands": operands,
    }


async def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point invoked by Matimo's FunctionExecutor."""
    operation = params.get("operation")
    a = params.get("a")
    b = params.get("b")
    expression = params.get("expression")

    precision = _validate_precision(params.get("precision"))

    has_expression = isinstance(expression, str) and expression.strip() != ""
    has_operation = isinstance(operation, str) and operation.strip() != ""
    has_operands = a is not None or b is not None

    if has_expression and (has_operation or has_operands):
        raise CalculatorError(
            "Provide either `expression` OR `operation` (with `a`/`b`) — not both."
        )

    if not has_expression and not has_operation:
        raise CalculatorError(
            "Must provide either `expression`, or `operation` (with `a` and, for binary "
            "operations, `b`)."
        )

    if has_expression:
        return _evaluate_expression(expression, precision)  # type: ignore[arg-type]

    return _evaluate_binary(operation, a, b, precision)  # type: ignore[arg-type]
