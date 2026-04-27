import os
import shutil
import json
import asyncio

from matimo.instance import Matimo

async def main():
    print("+" + "="*56 + "+")
    print("|     Bruno Tools - Complete Workflow (Python)           |")
    print("|     (7 tools + 6 workflows)                            |")
    print("+" + "="*56 + "+")

    # Paths and Setup
    workspace_dir = "./example-collections"
    collection_name = "sample-api"
    collection_path = os.path.join(workspace_dir, collection_name)
    test_api_url = "https://jsonplaceholder.typicode.com" # Real, public test API

    print(f"📁 Workspace Directory: {workspace_dir}")
    print(f"🌐 Test API: JSONPlaceholder ({test_api_url})\n")

    # Clean workspace
    if os.path.exists(workspace_dir):
        shutil.rmtree(workspace_dir)
    os.makedirs(workspace_dir, exist_ok=True)

    # Initialize Matimo
    print("🚀 Initializing Matimo...")
    from matimo_bruno import get_tools_path
    m = await Matimo.init(get_tools_path())
    
    tools_list = m.list_tools()
    print(f"✅ Loaded {len(tools_list)} tools")

    # Introspect available Bruno tools
    bruno_tools = [t for t in tools_list if t.name.startswith("bruno_")]
    print(f"\n🔧 Found {len(bruno_tools)} Bruno tools:")
    for t in bruno_tools:
        print(f"   • {t.name} - {t.description[:60]}...")

    print("\n" + "=" * 60)
    print("\nRunning 6 Complete Workflows:")
    print("=" * 60)

    # 1️⃣ WORKFLOW 1: Create Collection & Add Requests
    print("\n1️⃣  WORKFLOW 1: Create Collection & Add Requests")
    print("-" * 60)
    try:
        print(f"📁 Creating collection at: {collection_path}")
        result = await m.execute("bruno_create_collection", {
            "collection_name": "Sample API Tests",
            "collection_path": collection_path
        })
        print(f"   ✅ Collection created at {result['collection_path']}")

        print("\n📝 Adding 4 HTTP requests...")
        # Add a GET request
        await m.execute("bruno_add_request", {
            "collection_path": collection_path,
            "request_name": "fetch-todos",
            "method": "GET",
            "url": f"{test_api_url}/todos/1"
        })
        print("   ✅ GET request added")

        # Add a POST request
        await m.execute("bruno_add_request", {
            "collection_path": collection_path,
            "request_name": "create-todo",
            "method": "POST",
            "url": f"{test_api_url}/todos",
            "body": '{"title": "Learn Matimo", "completed": false, "userId": 1}'
        })
        print("   ✅ POST request added")

        # Add a PUT request
        await m.execute("bruno_add_request", {
            "collection_path": collection_path,
            "request_name": "update-todo",
            "method": "PUT",
            "url": f"{test_api_url}/todos/1",
            "body": '{"id": 1, "title": "Master Matimo", "completed": true, "userId": 1}'
        })
        print("   ✅ PUT request added")

        # Add a DELETE request
        await m.execute("bruno_add_request", {
            "collection_path": collection_path,
            "request_name": "delete-todo",
            "method": "DELETE",
            "url": f"{test_api_url}/todos/1"
        })
        print("   ✅ DELETE request added")
    except Exception as e:
        print(f"❌ Error in Workflow 1: {e}")

    # 2️⃣ WORKFLOW 2: Inspect Collection Structure
    print("\n2️⃣  WORKFLOW 2: Inspect Collection Structure")
    print("-" * 60)
    try:
        print("🔍 Getting collection info...")
        info = await m.execute("bruno_get_collection_info", {"collection_path": collection_path})
        print(f"   ✅ Collection found:")
        if info.get("success"):
            print(f"      Name: {info.get('collection', {}).get('name', 'Unknown')}")
            print(f"      Path: {info.get('collection', {}).get('path', 'Unknown')}")
            requests = info.get('collection', {}).get('requests', [])
            print(f"      Requests: {len(requests)}")
            print(f"      Requests list:")
            for r in requests:
                print(f"        • {r.get('name', 'Unknown')} [{r.get('method', 'UNKNOWN')}]")
        else:
            print(f"      Errors: {info.get('errors', [])}")
    except Exception as e:
        print(f"❌ Error in Workflow 2: {e}")

    # 3️⃣ WORKFLOW 3: Execute Collection with Tests
    print("\n3️⃣  WORKFLOW 3: Execute Collection with Tests")
    print("-" * 60)
    try:
        print("🏃 Running collection...")
        run_result = await m.execute("bruno_run_collection", {"collection_path": collection_path})
        
        if run_result.get("success"):
            print(f"   ✅ Collection Execution Summary:")
            summary = run_result.get('summary', {})
            print(f"      Total: {summary.get('total', 0)}")
            print(f"      Passed: {summary.get('passed', 0)}")
            print(f"      Failed: {summary.get('failed', 0)}")
            print(f"      Duration: {summary.get('duration_ms', 0)}ms")
        else:
            errors = run_result.get('errors', [])
            if errors and "bru" in str(errors).lower():
                print("   ⚠️  Note: Bruno CLI (bru) not found. Install Bruno to use this feature.")
            else:
                print(f"   ❌ Execution failed: {errors}")
    except Exception as e:
        print(f"❌ Error in Workflow 3: {e}")

    # 4️⃣ WORKFLOW 4: Execute Single Request
    print("\n4️⃣  WORKFLOW 4: Execute Single Request")
    print("-" * 60)
    try:
        request_name = "fetch-todos"
        print(f"🔎 Running single request: {request_name}")
        req_result = await m.execute("bruno_run_request", {
            "collection_path": collection_path,
            "request_name": request_name
        })
        
        if req_result.get("success"):
            print(f"   ✅ Request Execution:")
            print(f"      Name: {req_result.get('request', {}).get('name', 'Unknown')}")
            print(f"      Status: {req_result.get('response', {}).get('status', 0)}")
        else:
            errors = req_result.get('errors', [])
            if errors and "bru" in str(errors).lower():
                print("   ⚠️  Note: Bruno CLI (bru) not found. Install Bruno to use this feature.")
            else:
                print(f"   ❌ Execution failed: {errors}")
    except Exception as e:
        print(f"❌ Error in Workflow 4: {e}")

    # 5️⃣ WORKFLOW 5: List Available Collections
    print("\n5️⃣  WORKFLOW 5: List Available Collections")
    print("-" * 60)
    try:
        print(f"🔍 Listing collections in: {workspace_dir}")
        list_result = await m.execute("bruno_list_collections", {"workspace_path": workspace_dir})
        if list_result.get("success"):
            collections = list_result.get('collections', [])
            print(f"   ✅ Found {len(collections)} collection(s):")
            for coll in collections:
                if isinstance(coll, dict):
                    print(f"      📁 {coll.get('name', 'Unknown')} ({coll.get('path', 'Unknown')})")
                else:
                    print(f"      📁 {coll}")
        else:
            print(f"   ❌ Failed: {list_result.get('errors', [])}")
    except Exception as e:
        print(f"❌ Error in Workflow 5: {e}")

    # 6️⃣ WORKFLOW 6: Bootstrap from OpenAPI
    print("\n6️⃣  WORKFLOW 6: Bootstrap from OpenAPI")
    print("-" * 60)
    try:
        # Try a simpler OpenAPI spec that's more likely to be available
        openapi_url = "https://api.github.com/repos/swagger-api/swagger-petstore/contents/2.0/swagger.yaml"
        import_path = os.path.join(workspace_dir, "petstore-api")
        print(f"🌍 Importing from OpenAPI: {openapi_url}")
        
        import_result = await m.execute("bruno_import_openapi", {
            "spec_source": openapi_url,
            "output_directory": import_path
        })
        
        if import_result.get("success"):
            print(f"   ✅ Import Status: Success ✅")
            if os.path.exists(import_path):
                print(f"      📁 Collection bootstrapped at: {import_path}")
        else:
            errors = import_result.get('errors', [])
            if errors and "bru" in str(errors).lower():
                print("   ⚠️  Note: Bruno CLI (bru) not found. Install Bruno to use this feature.")
            elif errors and "404" in str(errors):
                print("   ⚠️  Note: OpenAPI URL returned 404. This is expected if the URL is not available.")
            else:
                print(f"   ℹ️  Import note: {errors}")
    except Exception as e:
        print(f"❌ Error in Workflow 6: {e}")

    print("\n" + "=" * 60)
    print("🚀 All Bruno Workflows Complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
