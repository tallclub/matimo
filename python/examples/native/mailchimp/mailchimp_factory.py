#!/usr/bin/env python3
"""
============================================================================
MAILCHIMP TOOLS - FACTORY PATTERN EXAMPLE
============================================================================

PATTERN: SDK Factory Pattern — Complete CRUD Workflow
─────────────────────────────────────────────────────────────────────────
This example runs a full end-to-end Mailchimp workflow using only the
API key. No other configuration is needed — IDs are discovered at runtime
by calling the tools themselves.

FLOW:
  1. GET    — Fetch your audiences, pick the first one automatically
  2. READ   — List subscribers in that audience, pick the first real contact
  3. UPDATE — Update that contact's name
  4. CREATE — Build a campaign targeting the audience
  (send-campaign and remove-member require approval — shown as next steps)

SETUP:
─────────────────────────────────────────────────────────────────────────
  export MAILCHIMP_API_KEY=abc123def456-us6
  python mailchimp_factory.py

Only MAILCHIMP_API_KEY is required. The server prefix and audience ID are
discovered automatically by the tools.

============================================================================
"""

import asyncio
import os
import sys
from dotenv import load_dotenv
from matimo import Matimo


async def run_mailchimp_factory_flow():
    print('\n╔════════════════════════════════════════════════════════╗')
    print('║   Mailchimp - Factory Pattern (Full CRUD Flow)         ║')
    print('╚════════════════════════════════════════════════════════╝\n')

    load_dotenv()
    api_key = os.getenv('MAILCHIMP_API_KEY')
    if not api_key:
        print('❌ MAILCHIMP_API_KEY not set.')
        print('   export MAILCHIMP_API_KEY="abc123def456-us6"')
        print('   Get one from: https://us1.admin.mailchimp.com/account/api/')
        sys.exit(1)

    # Server prefix is the last segment of the API key (e.g. "us6" from "abc123-us6")
    server_prefix = api_key.split('-')[-1]
    print(f'🔑 API Key: is configured... 📍 Server: {server_prefix}\n')

    print('🚀 Initializing Matimo...')
    matimo = await Matimo.init(auto_discover=True)
    mailchimp_tools = [t for t in matimo.list_tools() if t.name.startswith('mailchimp-')]
    print(f'✅ {len(mailchimp_tools)} Mailchimp tools loaded\n')

    try:
        # ── STEP 1: GET AUDIENCES ─────────────────────────────────────────────
        print('─' * 60)
        print('STEP 1 — Get Audiences   [mailchimp-get-lists]')
        print('─' * 60)

        lists_result = await matimo.execute('mailchimp-get-lists', {
            'server_prefix': server_prefix,
            'count': 10,
        })
        lists_data = lists_result.get('data', lists_result) if isinstance(lists_result, dict) else lists_result

        if not lists_data.get('lists') or len(lists_data.get('lists', [])) == 0:
            print('❌ No audiences found. Create one at mailchimp.com first.')
            sys.exit(1)

        print(f'✅ Found {lists_data.get("total_items")} audience(s):')
        for lst in lists_data.get('lists', []):
            member_count = lst.get('stats', {}).get('member_count', 0)
            print(f'   • "{lst.get("name")}" ({lst.get("id")}) — {member_count} subscribers')

        # Automatically pick the first audience — no manual ID needed
        audience = lists_data.get('lists', [])[0]
        list_id: str = audience.get('id')
        print(f'\n   ➡️  Using audience: "{audience.get("name")}" ({list_id})\n')

        # ── STEP 2: READ SUBSCRIBERS ─ pick a real contact ───────────────────
        print('─' * 60)
        print('STEP 2 — Read Subscribers   [mailchimp-get-list-members]')
        print('─' * 60)

        members_result = await matimo.execute('mailchimp-get-list-members', {
            'server_prefix': server_prefix,
            'list_id': list_id,
            'status': 'subscribed',
            'count': 5,
            'offset': 0,
        })
        members_data = members_result.get('data', members_result) if isinstance(members_result, dict) else members_result

        if not members_data.get('members') or len(members_data.get('members', [])) == 0:
            print('❌ No subscribed members found in this audience. Add a contact first.')
            sys.exit(1)

        print(f'✅ {members_data.get("total_items")} total subscribed member(s) — showing up to 5:')
        for m in members_data.get('members', []):
            print(f'   • {m.get("email_address")} ({m.get("status")})')

        # Use the first real contact from the list — no fake emails needed
        contact = members_data.get('members', [])[0]
        subscriber_hash: str = contact.get('id')
        print(f'\n   ➡️  Using contact: {contact.get("email_address")} (hash: {subscriber_hash})\n')

        # ── STEP 3: UPDATE THE SUBSCRIBER ─────────────────────────────────────
        print('─' * 60)
        print('STEP 3 — Update Subscriber   [mailchimp-update-list-member]')
        print('─' * 60)

        try:
            update_result = await matimo.execute('mailchimp-update-list-member', {
                'server_prefix': server_prefix,
                'list_id': list_id,
                'subscriber_hash': subscriber_hash,
                'status': 'subscribed',
                'merge_fields': contact.get('merge_fields', {}),
            })
            update_data = update_result.get('data', update_result) if isinstance(update_result, dict) else update_result

            if update_data.get('id') or update_data.get('email_address'):
                print(f'✅ Subscriber confirmed/updated:')
                print(f'   Email:  {update_data.get("email_address")}')
                print(f'   Status: {update_data.get("status")}\n')
            else:
                print(f'⚠️  Update response: {update_data}\n')
        except Exception as update_error:
            error_msg = str(update_error)
            print(f'⚠️  Update skipped: {error_msg}')
            print(f'   (This contact may have merge field validation issues in Mailchimp.)\n')

        # ── STEP 4: CREATE A CAMPAIGN ─────────────────────────────────────────
        print('─' * 60)
        print('STEP 4 — Create Campaign   [mailchimp-create-campaign]')
        print('─' * 60)

        from datetime import datetime
        today_date = datetime.utcnow().isoformat().split('T')[0]

        campaign_result = await matimo.execute('mailchimp-create-campaign', {
            'server_prefix': server_prefix,
            'type': 'regular',
            'list_id': list_id,
            'subject_line': 'Welcome — created by Matimo',
            'preview_text': 'This campaign was built automatically by the Matimo factory example.',
            'title': f'Matimo Factory Demo — {today_date}',
            'from_name': 'Matimo Demo',
            'reply_to': contact.get('email_address'),
        })
        campaign_data = campaign_result.get('data', campaign_result) if isinstance(campaign_result, dict) else campaign_result

        if campaign_data.get('id'):
            print(f'✅ Campaign created (not sent):')
            print(f'   Campaign ID: {campaign_data.get("id")}')
            print(f'   Status:      {campaign_data.get("status")}')
            print(f'   Audience:    "{audience.get("name")}"\n')
        else:
            print(f'⚠️  Campaign response: {campaign_data}\n')

        # ── NEXT STEPS (approval required) ───────────────────────────────────
        print('─' * 60)
        print('NEXT STEPS  (these tools require approval flag: true)')
        print('─' * 60)
        campaign_id = campaign_data.get('id', '<id>')
        print(f'   • Send campaign:     mailchimp-send-campaign   {{ campaign_id: "{campaign_id}" }}')
        print(f'   • Remove subscriber: mailchimp-remove-list-member  {{ list_id: "{list_id}", subscriber_hash: "{subscriber_hash}" }}')
        print()

    except Exception as error:
        print(f'❌ Error: {error}')
        sys.exit(1)

    print('════════════════════════════════════════════════════════════')
    print('✨ Full CRUD Flow Complete!')
    print('════════════════════════════════════════════════════════════\n')


async def main():
    await run_mailchimp_factory_flow()


if __name__ == '__main__':
    asyncio.run(main())
