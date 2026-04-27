import os
from pathlib import Path
from typing import Any


def bruno_add_request(
    collection_path: str,
    request_name: str,
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    body: str | None = None,
    tests: str | None = None,
    documentation: str | None = None,
) -> dict[str, Any]:
    """
    Add a new HTTP request to a Bruno collection programmatically.
    Creates a .bru file with the specified method, URL, headers, body, and tests.
    """
    try:
        # Validate inputs
        if not collection_path or not request_name:
            return {
                "success": False,
                "request_path": "",
                "request_name": "",
                "message": "collection_path and request_name are required",
            }

        # Create requests directory if it doesn't exist
        collection_dir = Path(collection_path)
        requests_dir = collection_dir / "requests"
        requests_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename
        filename = f"{request_name.lower().replace(' ', '-')}.bru"
        request_path = requests_dir / filename

        # Generate .bru file content
        content = _generate_bru_content(
            request_name, method, url, headers, body, tests, documentation
        )

        # Write file
        request_path.write_text(content, encoding="utf-8")

        return {
            "success": True,
            "request_path": str(request_path),
            "request_name": request_name,
            "message": f"Request '{request_name}' added to collection successfully",
        }
    except Exception as e:
        return {
            "success": False,
            "request_path": "",
            "request_name": request_name,
            "message": f"Failed to add request: {str(e)}",
        }


def _generate_bru_content(
    request_name: str,
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    body: str | None = None,
    tests: str | None = None,
    documentation: str | None = None,
) -> str:
    """Generate Bruno .bru file content from parameters."""
    lines: list[str] = []

    # Metadata section
    if documentation:
        lines.append("meta {")
        lines.append(f"  name: {request_name}")
        lines.append("  type: http")
        lines.append("  seq: 1")
        lines.append("}")
        lines.append("")
        lines.append("docs {")
        lines.append(f"  {documentation}")
        lines.append("}")
        lines.append("")
    else:
        lines.append("meta {")
        lines.append(f"  name: {request_name}")
        lines.append("  type: http")
        lines.append("  seq: 1")
        lines.append("}")
        lines.append("")

    # Method and URL
    body_type = "json" if body else "none"
    lines.append(f"{method} {{")
    lines.append(f"  url: {url}")
    lines.append(f"  body: {body_type}")
    lines.append("  auth: inherit")
    lines.append("}")
    lines.append("")

    # Headers
    if headers and len(headers) > 0:
        lines.append("headers {")
        for key, value in headers.items():
            lines.append(f"  {key}: {value}")
        lines.append("}")
        lines.append("")

    # Body
    if body:
        lines.append("body:json {")
        for line in body.split("\n"):
            lines.append(f"  {line}")
        lines.append("}")
        lines.append("")

    # Tests
    if tests:
        lines.append("tests {")
        for line in tests.split("\n"):
            lines.append(f"  {line}")
        lines.append("}")

    return "\n".join(lines)


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return bruno_add_request(
        collection_path=params["collection_path"],
        request_name=params["request_name"],
        method=params["method"],
        url=params["url"],
        headers=params.get("headers"),
        body=params.get("body"),
        tests=params.get("tests"),
        documentation=params.get("documentation"),
    )
