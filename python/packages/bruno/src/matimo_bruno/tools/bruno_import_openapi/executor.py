import subprocess
import logging
from typing import Any

from matimo_bruno._bru_utils import check_bru_version

logger = logging.getLogger(__name__)


def execute(params: dict[str, Any]) -> dict[str, Any]:
    """Import OpenAPI specification into Bruno collection using 'bru import openapi'."""
    spec_source = params.get("spec_source")
    output_directory = params.get("output_directory")
    collection_name = params.get("collection_name")
    collection_format = params.get("collection_format", "bru")
    group_by = params.get("group_by", "tags")
    insecure = params.get("insecure", False)
    
    if not spec_source or not output_directory:
        raise ValueError("spec_source and output_directory parameters are required")

    check_bru_version()

    try:
        logger.info(f"Importing OpenAPI from: {spec_source} to {output_directory}")
        
        # Build bru import openapi command with all supported options
        # Bruno v3: bru import openapi --source <spec> --output <dir> [--format <fmt>] [--group-by <key>] [--insecure]
        args = ["bru", "import", "openapi", "--source", spec_source, "--output", output_directory]
        
        # Add optional parameters as CLI flags
        if collection_format and collection_format in ("bru", "opencollection"):
            args.extend(["--format", collection_format])
        
        if group_by and group_by in ("tags", "path"):
            args.extend(["--group-by", group_by])
        
        if insecure:
            args.append("--insecure")
        
        logger.debug(f"Executing: {' '.join(args)}")
        
        result = subprocess.run(args, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            logger.error(f"OpenAPI import failed: {result.stderr}")
            return {
                "success": False,
                "collection_path": output_directory,
                "collection_name": collection_name or "",
                "requests_created": 0,
                "message": "Import failed",
                "errors": [result.stderr]
            }
        
        logger.info("OpenAPI import completed")
        
        return {
            "success": True,
            "collection_path": output_directory,
            "collection_name": collection_name or "Imported Collection",
            "requests_created": 0,
            "message": "Collection imported successfully from OpenAPI",
            "errors": []
        }
    except subprocess.TimeoutExpired:
        logger.error("OpenAPI import timed out")
        return {
            "success": False,
            "collection_path": output_directory,
            "collection_name": "",
            "requests_created": 0,
            "message": "Import timed out",
            "errors": ["Execution timed out"]
        }
    except Exception as e:
        logger.error(f"OpenAPI import failed: {str(e)}")
        return {
            "success": False,
            "collection_path": output_directory,
            "collection_name": "",
            "requests_created": 0,
            "message": "Import failed",
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
