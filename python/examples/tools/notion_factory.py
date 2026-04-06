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
5. Add comments to pages

============================================================================
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

from matimo import Matimo


async def run_factory_pattern_examples():
    """Run factory pattern examples with REAL Notion operations"""
    print("\n╔════════════════════════════════════════════════════════╗")
    print("║     NOTION - Factory Pattern (REAL OPERATIONS)        ║")
    print("║     Discovering & querying your workspace             ║")
    print("╚════════════════════════════════════════════════════════╝\n")

    api_key = os.getenv("NOTION_API_KEY")
    if not api_key:
        print("❌ Error: NOTION_API_KEY not set in .env")
        sys.exit(1)

    matimo = await Matimo.init(auto_discover=True)
    all_tools = matimo.list_tools()
    notion_tools = [t for t in all_tools if t.name.startswith("notion_")]

    print(f"✅ Found {len(notion_tools)} Notion tools\n")
    print("DEBUG: Notion tools discovered:")
    for tool in notion_tools:
        print(f"  • {tool.name}")
    print("Debug: All available tools:")
    for tool in all_tools:
        print(f"  • {tool.name}")
    print("")
    print("════════════════════════════════════════════════════════════\n")
    print("REAL NOTION OPERATIONS:")
    print("════════════════════════════════════════════════════════════\n")

    try:
        # STEP 1: List all databases in workspace
        print("1️⃣  DISCOVERING YOUR WORKSPACE...\n")
        list_result = await matimo.execute(
            "notion_list_databases",
            {
                "page_size": 10,
            },
        )

        databases = list_result.get("data", {}).get("results", [])
        if not databases:
            print("   ℹ️  No databases found. Create and share one first.\n")
            return

        print(f"✅ Found {len(databases)} database(s) in workspace\n")

        found_database = databases[0]
        db_title = (
            found_database.get("title", [{}])[0].get("plain_text") or "Untitled"
        )
        print(f'   📊 Using database: "{db_title}"')
        print(f"   🔑 ID: {found_database.get('id')}\n")

        # STEP 2: Query database
        print("2️⃣  QUERYING DATABASE...\n")
        query_result = await matimo.execute(
            "notion_query_database",
            {
                "database_id": found_database.get("id"),
                "page_size": 5,
            },
        )

        query_data = query_result.get("data", {})
        results = query_data.get("results", [])

        if results:
            print(f"✅ Retrieved {len(results)} page(s)\n")
            for idx, page in enumerate(results[:3]):
                properties = page.get("properties", {})
                first_prop = next(iter(properties.values()), {})
                title = (
                    first_prop.get("title", [{}])[0].get("plain_text", "")
                    if "title" in first_prop
                    else first_prop.get("rich_text", [{}])[0].get("plain_text", "")
                    if "rich_text" in first_prop
                    else "Untitled"
                )
                url = page.get("url")
                print(f"   {idx + 1}. {title}")
                print(f"      🔗 {url}\n")

            if len(results) > 3:
                print(f"   ... and {len(results) - 3} more\n")
        else:
            print("   ℹ️  Database is empty\n")

        # STEP 3: Create page with markdown (simple, works with any database)
        print("3️⃣  CREATING NEW PAGE...\n")
        page_title = f"Matimo Test {datetime.now().strftime('%H:%M:%S')}"

        # Prefer the database_id from the query results (page parent) if available,
        # otherwise fall back to the discovered database id from notion_list_databases.
        fallback_db_id = found_database.get("id")
        page_parent_db_id = (
            results[0].get("parent", {}).get("database_id")
            if results
            else None
        )
        resolved_database_id = page_parent_db_id or fallback_db_id

        create_params = {
            "parent": {"database_id": resolved_database_id},
            "markdown": f"# {page_title}\n\nCreated by Matimo at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "icon": {
                "type": "emoji",
                "emoji": "✅",
            },
        }

        print(
            f"DEBUG: Using database id for creation: {resolved_database_id} (from {'query result' if page_parent_db_id else 'discovery'})"
        )
        print(f"DEBUG: Creating page with params: {json.dumps(create_params, indent=2)}")

        create_result = await matimo.execute("notion_create_page", create_params)
        print(
            f"DEBUG: Create result: {json.dumps(create_result, indent=2)[:500]}"
        )

        create_data = create_result.get("data") or create_result
        if create_data and create_data.get("id"):
            print(f"✅ Page created!\n")
            print(f"   📄 Title: \"{page_title}\"")
            print(f"   🔑 ID: {create_data.get('id')}")
            print(f"   🔗 URL: {create_data.get('url')}\n")

            # STEP 4: Update page with emoji icon
            print("4️⃣  UPDATING PAGE WITH ICON...\n")
            try:
                await matimo.execute(
                    "notion_update_page",
                    {
                        "page_id": create_data.get("id"),
                        "icon": {
                            "type": "emoji",
                            "emoji": "🚀",
                        },
                    },
                )
                print(f"✅ Page updated with icon!\n")
            except Exception as err:
                error_msg = str(err)
                print(f"   ⚠️  Could not update: {error_msg}\n")

            # STEP 5: Add comment
            print("5️⃣  ADDING COMMENT...\n")
            try:
                comment_result = await matimo.execute(
                    "notion_create_comment",
                    {
                        "parent": {"page_id": create_data.get("id")},
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": f"Created by Matimo at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}. Real test! 🚀",
                                },
                            },
                        ],
                    },
                )

                print(
                    f"DEBUG: Comment result: {json.dumps(comment_result)[:500]}"
                )

                cr = comment_result.get("data") or comment_result
                if cr and cr.get("id"):
                    print(f"✅ Comment added!\n")
                elif (
                    comment_result.get("success") is False
                    or comment_result.get("statusCode")
                ):
                    print(
                        f"   ⚠️  Comment failed: {json.dumps(comment_result)[:200]}\n"
                    )
                else:
                    print(f"✅ Comment added (no id returned)\n")
            except Exception as err:
                try:
                    print(f"   ⚠️  Could not add comment. Error payload: {json.dumps(err)}")
                except Exception:
                    error_msg = str(err)
                    print(f"   ⚠️  Could not add comment: {error_msg}\n")

        else:
            print(
                f"   ⚠️  Failed to create page. Response: {json.dumps(create_data)[:200]}\n"
            )

            # If the database wasn't found or not shared, attempt a fallback:
            # create a child page under an existing page returned by the query above.
            err_code = (
                create_data.get("error", {}).get("code")
                if isinstance(create_data, dict)
                else ""
            )
            if err_code == "object_not_found":
                print(
                    "   ℹ️  Notion reports the database object was not found or not shared with the integration."
                )
                first_page = results[0] if results else None
                if first_page and first_page.get("id"):
                    print(
                        f"   ℹ️  Falling back to creating a sub-page under page id {first_page.get('id')}"
                    )
                    try:
                        fallback_result = await matimo.execute(
                            "notion_create_page",
                            {
                                "parent": {"page_id": first_page.get("id")},
                                "properties": {
                                    "Name": {
                                        "title": [
                                            {
                                                "text": {
                                                    "content": page_title
                                                }
                                            }
                                        ]
                                    }
                                },
                                "icon": {
                                    "type": "emoji",
                                    "emoji": "✅",
                                },
                            },
                        )

                        fr = fallback_result.get("data") or fallback_result
                        if fr and fr.get("id"):
                            print("   ✅ Fallback page created as child page!")
                            print(f"      🔑 ID: {fr.get('id')}")
                            print(f"      🔗 URL: {fr.get('url')}\n")
                        else:
                            print(
                                "   ⚠️  Fallback creation also failed. Check integration permissions and that the target page is shared."
                            )
                    except Exception as fb_err:
                        fb_error_msg = str(fb_err)
                        print(
                            f"   ⚠️  Fallback create threw an error: {fb_error_msg}"
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
            print(
                "   • Ensure your integration has read/write capabilities"
            )
            print("   • Share your Notion database with the integration")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_factory_pattern_examples())
