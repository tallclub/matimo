import subprocess
import logging
from pathlib import Path
from typing import Any

from matimo_bruno._bru_utils import check_bru_version

logger = logging.getLogger(__name__)


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Execute a single Bruno request using 'bru run'."""
    collection_path = params.get("collection_path")
    request_name = params.get("request_name")

    if not collection_path or not request_name:
        raise ValueError("collection_path and request_name parameters are required")

    check_bru_version()

    try:
        logger.info(f"Running request: {request_name} from {collection_path}")
        
        collection_dir = Path(collection_path)
        if not collection_dir.exists():
            return {
                "success": False,
                "request": {"name": request_name},
                "response": {"status": 0},
                "errors": [f"Collection not found: {collection_path}"]
            }
        
        # Find the request file in the collection
        request_file = collection_dir / f"{request_name}.bru"
        if not request_file.exists():
            # Try in requests subdirectory
            request_file = collection_dir / "requests" / f"{request_name}.bru"
        
        if not request_file.exists():
            return {
                "success": False,
                "request": {"name": request_name},
                "response": {"status": 0},
                "errors": [f"Request file not found: {request_name}"]
            }
        
        # Construct relative path from collection directory
        rel_path = request_file.relative_to(collection_dir)
        
        args = ["bru", "run", str(rel_path)]
        
        logger.debug(f"Executing: {' '.join(args)} (cwd: {collection_dir})")
        
        result = subprocess.run(
            args,
            cwd=str(collection_dir),
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            logger.error(f"Request execution failed: {result.stderr}")
            return {
                "success": False,
                "request": {"name": request_name},
                "response": {"status": 0},
                "errors": [result.stderr] if result.stderr else ["Execution failed"]
            }
        
        logger.info("Request execution completed")
        
        return {
            "success": True,
            "request": {"name": request_name},
            "response": {"status": 200},
            "errors": [],
            "details": result.stdout
        }
    except Exception as e:
        logger.error(f"Request execution failed: {str(e)}")
        return {
            "success": False,
            "request": {"name": request_name},
            "response": {"status": 0},
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
