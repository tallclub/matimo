import subprocess
import logging
import json
import tempfile
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

    # Always use JSON format for structured agent consumption
    report_path = params.get("report_path")
    if not report_path:
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix=".json", delete=False)
        report_path = temp_file.name
        temp_file.close()

    try:
        logger.info(f"Running Bruno collection: {collection_path}")
        
        collection_dir = Path(collection_path).resolve()
        if not collection_dir.exists():
            return {
                "success": False,
                "summary": {"total_requests": 0, "passed": 0, "failed": 0, "execution_time_ms": 0},
                "results": [],
                "errors": [f"Collection directory not found: {collection_path}"]
            }
        
        # Build command with optional parameters
        args = ["bru", "run", ".", "-r", "--reporter-json", report_path]
        
        if params.get("environment"):
            args.extend(["--env", params["environment"]])
        if params.get("env_file"):
            args.extend(["--env-file", params["env_file"]])
        if params.get("data_file"):
            args.extend(["--csv-file-path", params["data_file"]])
        if params.get("iteration_count"):
            args.extend(["--iteration-count", str(params["iteration_count"])])
        if params.get("delay_ms"):
            args.extend(["--delay", str(params["delay_ms"])])
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
        args.extend(["--sandbox", params.get("sandbox_mode", "safe")])
        
        logger.debug(f"Executing: {' '.join(args)} (cwd: {collection_dir})")
        
        # Run bru from the collection directory
        result = subprocess.run(
            args,
            cwd=str(collection_dir),
            capture_output=True,
            text=True,
            timeout=300
        )
        
        exit_code = result.returncode
        run_errors = []
        if exit_code != 0:
            logger.warning(f"bru run exited with non-zero status: {result.stderr}")
            if result.stderr:
                run_errors.append(result.stderr.strip())

        # Read JSON report
        report_data = {}
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                report_data = json.load(f)
        except Exception as e:
            logger.warning(f"Could not read/parse JSON report: {e}")
        
        # Map Bruno report fields to schema-declared keys
        summary_raw = report_data.get("summary", {})
        total_requests = summary_raw.get("totalRequests", 0)
        passed = summary_raw.get("passedRequests", 0)
        failed = summary_raw.get("failedRequests", 0)
        execution_time_ms = summary_raw.get("totalTime", 0)
        
        results = []
        for r in report_data.get("results", []):
            results.append({
                "name": r.get("suiteName") or r.get("name", "unknown"),
                "success": r.get("status") == "pass" or r.get("passed") is True,
                "status": (r.get("response") or {}).get("status", 0)
            })
        
        logger.info("Collection execution completed")
        
        return {
            "success": exit_code == 0,
            "summary": {
                "total_requests": total_requests,
                "passed": passed,
                "failed": failed,
                "execution_time_ms": execution_time_ms
            },
            "results": results,
            "report_path": report_path,
            "errors": run_errors
        }
    except subprocess.TimeoutExpired:
        logger.error("Collection execution timed out")
        return {
            "success": False,
            "summary": {"total_requests": 0, "passed": 0, "failed": 0, "execution_time_ms": 0},
            "results": [],
            "errors": ["Execution timed out"]
        }
    except Exception as e:
        logger.error(f"Collection execution failed: {str(e)}")
        return {
            "success": False,
            "summary": {"total_requests": 0, "passed": 0, "failed": 0, "execution_time_ms": 0},
            "results": [],
            "errors": [str(e)]
        }


def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point called by Matimo's FunctionExecutor."""
    return execute(params)
