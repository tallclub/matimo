#!/usr/bin/env python3
"""
============================================================================
BRUNO TOOLS - CREWAI AUTONOMOUS AGENT (Python)
============================================================================

PATTERN: CrewAI Multi-Agent Orchestration

SETUP:
─────────────────────────────────────────────────────────────────────────
1. Install dependencies:
   cd python && uv sync

2. Set OpenAI API key:
   export OPENAI_API_KEY="sk-..."

USAGE:
─────────────────────────────────────────────────────────────────────────
   uv run python examples/bruno/crewai_agent.py

WHAT IT DOES:
─────────────────────────────────────────────────────────────────────────
Uses 3 autonomous agents working together:
  1. Orchestrator - Plans and coordinates workflows
  2. Builder - Creates test collections and adds requests
  3. Executor - Runs tests and reports results

The crew autonomously:
  1. Creates collections
  2. Adds 4 HTTP requests (GET/POST/PUT/DELETE)
  3. Inspects collections
  4. Runs full test suites
  5. Debugs individual requests
  6. Imports from OpenAPI specs

============================================================================
"""

import asyncio
import json
import os
from typing import Any

from dotenv import load_dotenv
from crewai import Agent, Crew, Task
from langchain_openai import ChatOpenAI

from matimo import Matimo
from matimo_bruno import get_tools_path


class BrunoTools:
    """Wrapper for Bruno tools callable by CrewAI agents."""

    def __init__(self, matimo: Matimo) -> None:
        self.matimo = matimo

    async def create_collection(
        self, collection_path: str, collection_name: str
    ) -> str:
        """Create a new Bruno collection."""
        result = await self.matimo.execute(
            "bruno_create_collection",
            {
                "collection_path": collection_path,
                "collection_name": collection_name,
            },
        )
        return json.dumps(result, indent=2)

    async def add_request(
        self,
        collection_path: str,
        request_name: str,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        body: str | None = None,
        tests: str | None = None,
    ) -> str:
        """Add a request to a collection."""
        params: dict[str, Any] = {
            "collection_path": collection_path,
            "request_name": request_name,
            "method": method,
            "url": url,
        }
        if headers:
            params["headers"] = headers
        if body:
            params["body"] = body
        if tests:
            params["tests"] = tests

        result = await self.matimo.execute("bruno_add_request", params)
        return json.dumps(result, indent=2)

    async def run_collection(self, collection_path: str) -> str:
        """Run a full collection."""
        result = await self.matimo.execute(
            "bruno_run_collection",
            {
                "collection_path": collection_path,
                "bail_on_failure": False,
                "report_path": "./example-collections/report.json",
            },
        )
        return json.dumps(
            {
                "success": result.get("success"),
                "summary": result.get("summary"),
                "results_count": len(result.get("results", [])),
            },
            indent=2,
        )

    async def get_collection_info(self, collection_path: str) -> str:
        """Get collection information."""
        result = await self.matimo.execute(
            "bruno_get_collection_info",
            {"collection_path": collection_path},
        )
        collection = result.get("collection", {})
        requests = collection.get("requests", [])
        return json.dumps(
            {
                "name": collection.get("name"),
                "requests": len(requests),
                "request_names": [r.get("name") for r in requests],
            },
            indent=2,
        )

    async def run_request(self, collection_path: str, request_name: str) -> str:
        """Run a single request."""
        result = await self.matimo.execute(
            "bruno_run_request",
            {"collection_path": collection_path, "request_name": request_name},
        )
        return json.dumps(
            {
                "request": result.get("request"),
                "success": result.get("success"),
                "status": result.get("status"),
            },
            indent=2,
        )

    async def import_openapi(
        self,
        spec_source: str,
        output_directory: str,
        collection_name: str,
    ) -> str:
        """Import from OpenAPI spec."""
        result = await self.matimo.execute(
            "bruno_import_openapi",
            {
                "spec_source": spec_source,
                "output_directory": output_directory,
                "collection_name": collection_name,
                "group_by": "tags",
            },
        )
        return json.dumps(
            {
                "collection_name": result.get("collection_name"),
                "collection_path": result.get("collection_path"),
                "requests_generated": result.get("requests_generated"),
            },
            indent=2,
        )


async def main() -> None:
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     Bruno Tools - CrewAI Agent (Python)                ║")
    print("║     (Autonomous multi-agent orchestration)             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    # Load environment variables from .env file
    load_dotenv()

    # Verify OpenAI API key is available
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not found in environment or .env file")
        print("   Set OPENAI_API_KEY in .env file or environment to use this example")
        return

    # Initialize Matimo
    print("🚀 Initializing Matimo...")
    matimo = await Matimo.init(get_tools_path())
    tools = BrunoTools(matimo)

    all_tools = matimo.list_tools()
    bruno_tools = [t for t in all_tools if t.name.startswith("bruno")]
    print(f"✅ Loaded {len(bruno_tools)} Bruno tools\n")

    # Initialize LLM
    print("🤖 Initializing OpenAI LLM...\n")
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # Define agents
    orchestrator = Agent(
        role="API Test Orchestrator",
        goal="Autonomously create, build, and execute API test collections",
        backstory="Expert in API testing. Knows how to organize and execute comprehensive test suites.",
        llm=llm,
        verbose=False,
    )

    builder = Agent(
        role="Test Collection Builder",
        goal="Build comprehensive test collections by adding individual requests",
        backstory="Specializes in crafting well-structured API requests with assertions.",
        llm=llm,
        verbose=False,
    )

    executor = Agent(
        role="Test Execution Engine",
        goal="Execute test collections and report detailed results",
        backstory="Runs tests efficiently and provides comprehensive reports.",
        llm=llm,
        verbose=False,
    )

    # Define tasks
    create_task = Task(
        description="""Create a new Bruno collection called "sample-api-tests" 
        at path ./example-collections/sample-api-crewai.
        Report the creation status.""",
        agent=orchestrator,
        expected_output="Collection created successfully",
    )

    build_task = Task(
        description="""Add 4 HTTP requests to collection at ./example-collections/sample-api-crewai:
        1. GET https://jsonplaceholder.typicode.com/todos?_limit=5
        2. POST https://jsonplaceholder.typicode.com/todos with body
        3. PUT https://jsonplaceholder.typicode.com/todos/1 with body
        4. DELETE https://jsonplaceholder.typicode.com/todos/1
        
        Include proper headers for each.""",
        agent=builder,
        expected_output="All 4 requests added successfully",
    )

    info_task = Task(
        description="Get information about the collection at ./example-collections/sample-api-crewai to verify all requests are present.",
        agent=orchestrator,
        expected_output="Collection info showing all requests",
    )

    run_task = Task(
        description="Run the complete collection at ./example-collections/sample-api-crewai to execute all tests.",
        agent=executor,
        expected_output="Collection execution results with summary",
    )

    debug_task = Task(
        description="Execute the GET request individually from collection at ./example-collections/sample-api-crewai.",
        agent=executor,
        expected_output="Single request execution result",
    )

    import_task = Task(
        description="Import a test collection from Swagger Petstore OpenAPI spec (https://petstore.swagger.io/v2/swagger.json) to ./example-collections/petstore-crewai.",
        agent=orchestrator,
        expected_output="OpenAPI import successful",
    )

    # Create crew
    crew = Crew(
        agents=[orchestrator, builder, executor],
        tasks=[create_task, build_task, info_task, run_task, debug_task, import_task],
        verbose=False,
        process="sequential",
    )

    print("════════════════════════════════════════════════════════════\n")
    print("🧠 Agent Tasks:")
    print("  1️⃣  Create collection")
    print("  2️⃣  Add 4 HTTP requests (GET/POST/PUT/DELETE)")
    print("  3️⃣  Inspect collection")
    print("  4️⃣  Run full test suite")
    print("  5️⃣  Debug single request")
    print("  6️⃣  Import from OpenAPI\n")

    print("⏳ Crew is working on tasks...\n")

    try:
        result = crew.kickoff()
        print("\n" + "=" * 60)
        print("✅ CREW COMPLETED SUCCESSFULLY!")
        print("=" * 60 + "\n")
        print("Final Output:")
        print(result)
    except Exception as e:
        print(f"\n❌ Crew error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
