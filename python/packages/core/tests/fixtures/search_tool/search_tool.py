"""Minimal Python implementation of the search_tool (used in tests)."""


def run(params: dict) -> dict:
    query = params.get("query", "")
    return {"results": [f"result for: {query}"], "total": 1}
