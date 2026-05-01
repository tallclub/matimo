import subprocess
import logging
from pathlib import Path
from typing import Any

from matimo_bruno._bru_utils import check_bru_version

logger = logging.getLogger(__name__)


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Execute a Bruno collection using 'bru run'."""
    collection_path = params.get("collection_path")

    if not collection_path:
        raise ValueError("collection_path parameter is required")

    check_bru_version()

    try:
        logger.info(f"Running Bruno collection: {collection_path}")
        
        collection_dir = Path(collection_path)
        if not collection_dir.exists():
            return {
                "success": False,
                "summary": {"total": 0, "passed": 0, "failed": 0, "duration_ms": 0},
                "results": [],
                "errors": [f"Collection directory not found: {collection_path}"]
            }
        
        # Build command with optional parameters
        args = ["bru", "run"]
        
        if params.get("tags"):
            args.extend(["--tags", params["tags"]])
        if params.get("exclude_tags"):
            args.extend(["--exclude-tags", params["exclude_tags"]])
        if params.get("tests_only") is True:
            args.append("--tests-only")
        if params.get("bail_on_failure") is True:
            args.append("--bail")
        if params.get("parallel") is True:
            args.append("--parallel")
        
        logger.debug(f"Executing: {' '.join(args)} (cwd: {collection_dir})")
        
        # Run bru from the collection directory
        result = subprocess.run(
            args,
            cwd=str(collection_dir),
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            logger.error(f"Collection execution failed: {result.stderr}")
            return {
                "success": False,
                "summary": {"total": 0, "passed": 0, "failed": 0, "duration_ms": 0},
                "results": [],
                "errors": [result.stderr] if result.stderr else ["Execution failed"]
            }
        
        logger.info("Collection execution completed")
        
        return {
            "success": True,
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "duration_ms": 0
            },
            "results": [],
            "report_path": params.get("report_path"),
            "errors": []
        }
    except subprocess.TimeoutExpired:
        logger.error("Collection execution timed out")
        return {
            "success": False,
            "summary": {"total": 0, "passed": 0, "failed": 0, "duration_ms": 0},
            "results": [],
            "errors": ["Execution timed out"]
        }
    except Exception as e:
        logger.error(f"Collection execution failed: {str(e)}")
        return {
            "success": False,
            "summary": {"total": 0, "passed": 0, "failed": 0, "duration_ms": 0},
            "results": [],
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
