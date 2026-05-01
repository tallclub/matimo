import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Get collection metadata and list requests by scanning .bru files."""
    collection_path = params.get("collection_path")
    
    if not collection_path:
        raise ValueError("collection_path parameter is required")

    try:
        logger.info(f"Getting collection info: {collection_path}")
        
        path_obj = Path(collection_path)
        
        if not path_obj.exists():
            return {
                "success": False,
                "collection": {},
                "errors": [f"Collection path not found: {collection_path}"]
            }
        
        # Read bruno.json if it exists
        bruno_json_file = path_obj / "bruno.json"
        collection_name = path_obj.name  # Default to directory name
        if bruno_json_file.exists():
            try:
                bruno_data = json.loads(bruno_json_file.read_text())
                collection_name = bruno_data.get("name") or collection_name
            except Exception as e:
                logger.warning(f"Could not parse bruno.json: {e}")
        
        # Scan for .bru request files
        requests = []
        for bru_file in path_obj.rglob("*.bru"):
            try:
                content = bru_file.read_text()
                
                # Parse method (get, post, put, delete, patch, head, options)
                method = "UNKNOWN"
                for m in ["get", "post", "put", "patch", "delete", "head", "options"]:
                    if f"{m} {{" in content.lower():
                        method = m.upper()
                        break
                
                # Parse request name from meta block or use filename
                req_name = bru_file.stem
                import re
                for line in content.split("\n"):
                    if "name:" in line.lower():
                        # Extract name value
                        parts = line.split(":", 1)
                        if len(parts) > 1:
                            req_name = parts[1].strip()
                            break
                
                # Parse URL from the .bru file
                url = ""
                for line in content.split("\n"):
                    if line.strip().startswith("url:"):
                        url = line.split(":", 1)[1].strip() if ":" in line else ""
                        break
                
                # Parse tags
                tags: list[str] = []
                tags_match = re.search(r'tags:\s*\[([^\]]*)\]', content)
                if tags_match:
                    tags_str = tags_match.group(1)
                    tags = [t.strip().strip('"\'') for t in tags_str.split(",") if t.strip()]
                
                # Check for tests
                has_tests = "tests {" in content.lower()
                
                requests.append({
                    "name": req_name,
                    "method": method,
                    "url": url,
                    "path": str(bru_file),
                    "tags": tags,
                    "has_tests": has_tests
                })
            except Exception as e:
                logger.debug(f"Could not parse {bru_file}: {e}")
        
        return {
            "success": True,
            "collection": {
                "name": collection_name,
                "path": str(collection_path),
                "requests": requests
            },
            "errors": []
        }
    except Exception as e:
        logger.error(f"Get collection info failed: {str(e)}")
        return {
            "success": False,
            "collection": {},
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
