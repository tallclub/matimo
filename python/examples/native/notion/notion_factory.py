#!/usr/bin/env python3
"""
============================================================================
NOTION TOOLS - FACTORY PATTERN EXAMPLE (REAL OPERATIONS)
============================================================================

This example demonstrates REAL Notion API operations:
1. Search the workspace to discover databases
2. Query actual databases for real data
3. Create new pages with real data
4. Update existing pages
5. Show actual results from your Notion workspace

============================================================================
"""

import asyncio
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from matimo import Matimo


async def run_factory_pattern_examples():
    """Run factory pattern examples with REAL Notion operations"""
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     NOTION - Factory Pattern (REAL OPERATIONS)        ║")
    print("║     Discovering & querying your workspace             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    load_dotenv()
    api_key = os.getenv("NOTION_API_KEY")
    if not api_key:
        print("❌ Error: NOTION_API_KEY not set in .env")
        exit(1)

    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    notion_tools = [t for t in all_tools if t.name.startswith("notion_")]

    print(f"✅ Found {len(notion_tools)} Notion tools\n")

    print("════════════════════════════════════════════════════════════\n")
    print("REAL NOTION OPERATIONS:")
    print("════════════════════════════════════════════════════════════\n")

    try:
        # STEP 1: List all databases in workspace
        print("1️⃣  DISCOVERING YOUR WORKSPACE...\n")
        list_result = await matimo.execute("notion_list_databases", {"page_size": 10})

        databases = list_result.get("results", [])
        if not databases:
            print("   ℹ️  No databases found. Create and share one first.\n")
            return

        print(f"✅ Found {len(databases)} database(s) in workspace\n")

        found_database = databases[0]
        db_title = found_database.get("title", [{}])[0].get("plain_text", "Untitled")
        print(f"   📊 Using database: \"{db_title}\"")
        print(f"   🔑 ID: {found_database['id']}\n")

        # STEP 2: Query database
        print("2️⃣  QUERYING DATABASE...\n")
        query_result = await matimo.execute(
            "notion_query_database",
            {"database_id": found_database["id"], "page_size": 5},
        )

        query_data = query_result
        if query_data.get("results") and len(query_data["results"]) > 0:
            print(f"✅ Retrieved {len(query_data['results'])} page(s)\n")
            for idx, page in enumerate(query_data["results"][:3]):
                props = page.get("properties", {})
                title = "Untitled"
                for _key, prop_val in props.items():
                    if isinstance(prop_val, dict):
                        rich_texts = prop_val.get("title") or prop_val.get("rich_text") or []
                        if rich_texts and isinstance(rich_texts, list):
                            title = rich_texts[0].get("plain_text", "Untitled")
                            break
                url = page.get("url", "")
                print(f"   {idx + 1}. {title}")
                print(f"      🔗 {url}\n")
            if len(query_data["results"]) > 3:
                print(f"   ... and {len(query_data['results']) - 3} more\n")
        else:
            print("   ℹ️  Database is empty\n")

        # STEP 3: Create page with markdown (simple, works with any database)
        print("3️⃣  CREATING NEW PAGE...\n")
        page_title = f"Matimo Test {datetime.now().strftime('%H:%M:%S')}"

        # Prefer the database_id from the query results (page parent) if available,
        # otherwise fall back to the discovered database id from notion_list_databases.
        fallback_db_id = found_database["id"]
        page_parent_db_id = (
            query_data.get("results", [{}])[0].get("parent", {}).get("database_id")
        )
        resolved_database_id = page_parent_db_id or fallback_db_id

        create_params = {
            "parent": {"database_id": resolved_database_id},
            "markdown": f"# {page_title}\n\nCreated by Matimo at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "icon": {"type": "emoji", "emoji": "✅"},
        }

        create_result = await matimo.execute("notion_create_page", create_params)

        create_data = create_result.get("data") or create_result
        if create_data and create_data.get("id"):
            print("✅ Page created!\n")
            print(f"   📄 Title: \"{page_title}\"")
            print(f"   🔑 ID: {create_data['id']}")
            print(f"   🔗 URL: {create_data['url']}\n")

            # STEP 4: Update page with emoji icon
            print("4️⃣  UPDATING PAGE WITH ICON...\n")
            try:
                await matimo.execute(
                    "notion_update_page",
                    {
                        "page_id": create_data["id"],
                        "icon": {"type": "emoji", "emoji": "🚀"},
                    },
                )
                print("✅ Page updated with icon!\n")
            except Exception as err:
                print(f"   ⚠️  Could not update: {str(err)}\n")

            # STEP 5: Add comment
            print("5️⃣  ADDING COMMENT...\n")
            try:
                comment_result = await matimo.execute(
                    "notion_create_comment",
                    {
                        "parent": {"page_id": create_data["id"]},
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": f"Created by Matimo at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}. Real test! 🚀"
                                },
                            }
                        ],
                    },
                )


                cr = comment_result.get("data") or comment_result
                if cr and cr.get("id"):
                    print("✅ Comment added!\n")
                elif comment_result and (
                    comment_result.get("success") is False
                    or comment_result.get("statusCode")
                ):
                    print(
                        f"   ⚠️  Comment failed: {str(json.dumps(comment_result))[:200]}\n"
                    )
                else:
                    print("✅ Comment added (no id returned)\n")
            except Exception as err:
                try:
                    print(f"   ⚠️  Could not add comment. Error payload: {json.dumps(err)}")
                except Exception:
                    print(
                        f"   ⚠️  Could not add comment: {str(err)}\n"
                    )
        else:
            print(
                f"   ⚠️  Failed to create page. Response: {str(json.dumps(create_data))[:200]}\n"
            )

            # If the database wasn't found or not shared, attempt a fallback:
            # create a child page under an existing page returned by the query above.
            err_code = ""
            if isinstance(create_data, dict) and create_data.get("error"):
                err_code = create_data["error"].get("code", "")

            if err_code == "object_not_found":
                print(
                    "   ℹ️  Notion reports the database object was not found or not shared with the integration."
                )
                first_page = query_data.get("results", [{}])[0] if query_data.get("results") else None
                if first_page and first_page.get("id"):
                    print(f"   ℹ️  Falling back to creating a sub-page under page id {first_page['id']}")
                    try:
                        fallback_result = await matimo.execute(
                            "notion_create_page",
                            {
                                "parent": {"page_id": first_page["id"]},
                                "properties": {
                                    "Name": {
                                        "title": [{"text": {"content": page_title}}]
                                    }
                                },
                                "icon": {"type": "emoji", "emoji": "✅"},
                            },
                        )

                        fr = fallback_result.get("data") or fallback_result
                        if fr and fr.get("id"):
                            print("   ✅ Fallback page created as child page!")
                            print(f"      🔑 ID: {fr['id']}")
                            print(f"      🔗 URL: {fr['url']}\n")
                        else:
                            print(
                                "   ⚠️  Fallback creation also failed. Check integration permissions and that the target page is shared."
                            )
                    except Exception as fb_err:
                        print(
                            f"   ⚠️  Fallback create threw an error: {str(fb_err)}"
                        )
                else:
                    print(
                        "   ℹ️  No pages available to fall back to. Ensure your integration is shared with the target database."
                    )
            else:
                print(
                    "   ℹ️  Creation failed for other reasons; inspect the response above for details."
                )

        print("════════════════════════════════════════════════════════════\n")
        print("✨ COMPLETE!\n")
        print("📝 Check your Notion workspace to see the created page!\n")

    except Exception as error:
        msg = str(error)
        print(f"❌ Error: {msg}")
        if "401" in msg or "permission" in msg:
            print("   • Check your NOTION_API_KEY is valid")
            print("   • Ensure your integration has read/write capabilities")
            print("   • Share your Notion database with the integration")
        exit(1)


async def main() -> None:
    """Entry point for pyproject.toml console script."""
    await run_factory_pattern_examples()


if __name__ == "__main__":
    asyncio.run(main())
