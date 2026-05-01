import re
import subprocess
import logging
import time
from pathlib import Path
from typing import Any

from matimo_bruno._bru_utils import check_bru_version

logger = logging.getLogger(__name__)


def find_bru_file(root: Path, slug: str) -> Path | None:
    """Search recursively for a .bru file matching the given slug."""
    bru_file = root / f"{slug}.bru"
    if bru_file.exists():
        return bru_file
    
    # Search recursively
    for item in root.rglob(f"{slug}.bru"):
        if item.is_file():
            return item
    
    return None


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Execute a single Bruno request using 'bru run'."""
    collection_path = params.get("collection_path")
    request_name = params.get("request_name")

    if not collection_path or not request_name:
        raise ValueError("collection_path and request_name parameters are required")

    check_bru_version()

    collection_dir = Path(collection_path).resolve()
    slug = request_name.lower().replace(" ", "-")

    try:
        logger.info(f"Running request: {request_name} from {collection_dir}")
        
        # Locate the .bru file (may be in a requests/ subfolder)
        bru_file = find_bru_file(collection_dir, slug)
        if not bru_file:
            return {
                "success": False,
                "request": request_name,
                "status": 0,
                "duration_ms": 0,
                "errors": [f"Request file not found: {slug}.bru"]
            }
        
        # Construct relative path from collection directory
        rel_path = bru_file.relative_to(collection_dir)
        
        args = ["bru", "run", str(rel_path)]
        
        # Add optional parameters
        if params.get("environment"):
            args.extend(["--env", str(params["environment"])])
        if params.get("env_file"):
            args.extend(["--env-file", str(params["env_file"])])
        
        sandbox_mode = params.get("sandbox_mode", "safe")
        args.extend(["--sandbox", str(sandbox_mode)])
        
        logger.debug(f"Executing: {' '.join(args)} (cwd: {collection_dir})")
        
        start_time = time.time()
        result = subprocess.run(
            args,
            cwd=str(collection_dir),
            capture_output=True,
            text=True,
            timeout=60
        )
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Combine stdout and stderr for output
        output = result.stdout or ""
        if result.stderr:
            output += "\n" + result.stderr
        
        # Parse status code from bru run output (e.g. "200 OK")
        status_match = re.search(r"\b([1-5]\d{2})\b", output)
        status = int(status_match.group(1)) if status_match else (200 if result.returncode == 0 else 0)
        
        success = result.returncode == 0
        
        if not success:
            logger.error(f"Request execution failed: {output}")
        else:
            logger.info("Request execution completed")
        
        return {
            "success": success,
            "request": request_name,
            "status": status,
            "duration_ms": duration_ms,
            "errors": [] if success else [output]
        }
    except Exception as e:
        logger.error(f"Request execution failed: {str(e)}")
        return {
            "success": False,
            "request": request_name,
            "status": 0,
            "duration_ms": 0,
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
