"""Calculator tool — basic arithmetic operations."""
from __future__ import annotations

OPERATION_MAP = {
    "add": "add", "addition": "add", "sum": "add", "plus": "add", "+": "add",
    "subtract": "subtract", "subtraction": "subtract", "minus": "subtract",
    "sub": "subtract", "-": "subtract",
    "multiply": "multiply", "multiplication": "multiply", "times": "multiply",
    "product": "multiply", "mul": "multiply", "*": "multiply", "x": "multiply",
    "divide": "divide", "division": "divide", "div": "divide", "/": "divide",
}


async def run(params: dict) -> dict:  # type: ignore[type-arg]
    operation = str(params.get("operation", "")).lower().strip()
    a = float(params["a"])
    b = float(params["b"])
    canonical = OPERATION_MAP.get(operation, operation)
    if canonical == "add":
        result = a + b
    elif canonical == "subtract":
        result = a - b
    elif canonical == "multiply":
        result = a * b
    elif canonical == "divide":
        if b == 0:
            raise ValueError("Division by zero")
        result = a / b
    else:
        raise ValueError(f"Unknown operation: {operation}")
    return {
        "result": result,
        "operation": canonical,
        "original_operation": operation,
        "operands": {"a": a, "b": b},
    }
