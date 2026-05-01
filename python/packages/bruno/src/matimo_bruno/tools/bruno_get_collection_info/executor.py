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
        collection_name = None
        if bruno_json_file.exists():
            try:
                bruno_data = json.loads(bruno_json_file.read_text())
                collection_name = bruno_data.get("name", "Unknown")
            except Exception as e:
                logger.warning(f"Could not parse bruno.json: {e}")
        
        # Scan for .bru request files
        requests = []
        for bru_file in path_obj.rglob("*.bru"):
            try:
                content = bru_file.read_text()
                # Parse basic metadata from .bru file
                req_name = bru_file.stem
                method = "GET"  # default
                if "post {" in content.lower():
                    method = "POST"
                elif "put {" in content.lower():
                    method = "PUT"
                elif "delete {" in content.lower():
                    method = "DELETE"
                elif "patch {" in content.lower():
                    method = "PATCH"
                
                requests.append({
                    "name": req_name,
                    "method": method,
                    "path": str(bru_file.relative_to(path_obj))
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
