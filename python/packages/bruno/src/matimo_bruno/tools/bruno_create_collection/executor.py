import subprocess
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Create a new empty Bruno collection folder with bruno.json."""
    collection_path = params.get("collection_path")
    collection_name = params.get("collection_name")
    
    if not collection_path or not collection_name:
        raise ValueError("collection_path and collection_name parameters are required")

    try:
        logger.info(f"Creating collection: {collection_name} at {collection_path}")
        
        path_obj = Path(collection_path)
        path_obj.mkdir(parents=True, exist_ok=True)
        
        # Create bruno.json for the collection
        bruno_json = {
            "version": 1,
            "name": collection_name,
            "uid": collection_name.lower().replace(" ", "-")
        }
        
        bruno_file = path_obj / "bruno.json"
        bruno_file.write_text(json.dumps(bruno_json, indent=2), encoding="utf-8")
        
        logger.info("Collection created successfully")
        
        return {
            "success": True,
            "collection_path": str(collection_path),
            "message": f'Collection "{collection_name}" created at {collection_path}',
            "errors": []
        }
    except Exception as e:
        logger.error(f"Create collection failed: {str(e)}")
        return {
            "success": False,
            "collection_path": collection_path,
            "message": "Collection creation failed",
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
