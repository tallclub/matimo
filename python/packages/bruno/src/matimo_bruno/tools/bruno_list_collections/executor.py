import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def count_bru_files(directory: Path) -> int:
    """Recursively count .bru files in a directory."""
    count = 0
    try:
        for item in directory.rglob("*.bru"):
            if item.is_file():
                count += 1
    except Exception as e:
        logger.debug(f"Could not count .bru files in {directory}: {e}")
    return count


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """List all collections by scanning for bruno.json files."""
    workspace_path = params.get("workspace_path")
    
    if not workspace_path:
        raise ValueError("workspace_path parameter is required")

    try:
        logger.info(f"Listing collections in: {workspace_path}")
        
        workspace = Path(workspace_path)
        if not workspace.exists():
            return {
                "success": True,
                "collections": [],
                "errors": []
            }
        
        collections = []
        
        # Find all bruno.json files (collection markers)
        for bruno_json in workspace.rglob("bruno.json"):
            try:
                data = json.loads(bruno_json.read_text())
                collection_dir = bruno_json.parent
                
                # Count .bru files recursively for request_count
                request_count = count_bru_files(collection_dir)
                
                collections.append({
                    "name": data.get("name", collection_dir.name),
                    "path": str(collection_dir.relative_to(workspace)),
                    "request_count": request_count
                })
            except Exception as e:
                logger.debug(f"Could not parse {bruno_json}: {e}")
        
        # Apply filter if provided
        if params.get("filter"):
            filter_str = str(params["filter"]).lower()
            collections = [
                c for c in collections 
                if filter_str in c.get("name", "").lower() or filter_str in c.get("path", "").lower()
            ]
        
        return {
            "success": True,
            "collections": collections,
            "errors": []
        }
    except Exception as e:
        logger.error(f"List collections failed: {str(e)}")
        return {
            "success": False,
            "collections": [],
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
