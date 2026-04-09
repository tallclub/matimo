#!/usr/bin/env node
/**
 * ============================================================================
 * MAILCHIMP TOOLS - FACTORY PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: SDK Factory Pattern — Complete CRUD Workflow
 * ─────────────────────────────────────────────────────────────────────────
 * This example runs a full end-to-end Mailchimp workflow using only the
 * API key. No other configuration is needed — IDs are discovered at runtime
 * by calling the tools themselves.
 *
 * FLOW:
 *   1. GET    — Fetch your audiences, pick the first one automatically
 *   2. READ   — List subscribers in that audience, pick the first real contact
 *   3. UPDATE — Update that contact's name
 *   4. CREATE — Build a campaign targeting the audience
 *   (send-campaign and remove-member require approval — shown as next steps)
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MAILCHIMP_API_KEY=abc123def456-us6
 *   pnpm mailchimp:factory
 *
 * Only MAILCHIMP_API_KEY is required. The server prefix and audience ID are
 * discovered automatically by the tools.
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance } from 'matimo';

async function runMailchimpFactoryFlow() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Mailchimp - Factory Pattern (Full CRUD Flow)         ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    console.error('❌ MAILCHIMP_API_KEY not set.');
    console.info('   export MAILCHIMP_API_KEY="abc123def456-us6"');
    console.info('   Get one from: https://us1.admin.mailchimp.com/account/api/');
    process.exit(1);
  }

  // Server prefix is the last segment of the API key (e.g. "us6" from "abc123-us6")
  const serverPrefix = apiKey.split('-').pop()!;
  console.info(`🔑 API Key: is configured... 📍 Server:  \n`);

  console.info('🚀 Initializing Matimo...');
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  const mailchimpTools = matimo.listTools().filter((t) => t.name.startsWith('mailchimp-'));
  console.info(`✅ ${mailchimpTools.length} Mailchimp tools loaded\n`);

  try {
    // ── STEP 1: GET AUDIENCES ─────────────────────────────────────────────
    console.info('─'.repeat(60));
    console.info('STEP 1 — Get Audiences   [mailchimp-get-lists]');
    console.info('─'.repeat(60));

    const listsResult = await matimo.execute('mailchimp-get-lists', {
      server_prefix: serverPrefix,
      count: 10,
    });
    const listsData = (listsResult as any).data || listsResult;

    if (!listsData.lists || listsData.lists.length === 0) {
      console.error('❌ No audiences found. Create one at mailchimp.com first.');
      process.exit(1);
    }

    console.info(`✅ Found ${listsData.total_items} audience(s):`);
    listsData.lists.forEach((list: any) => {
      console.info(
        `   • "${list.name}" (${list.id}) — ${list.stats?.member_count ?? 0} subscribers`
      );
    });

    // Automatically pick the first audience — no manual ID needed
    const audience = listsData.lists[0];
    const listId: string = audience.id;
    console.info(`\n   ➡️  Using audience: "${audience.name}" (${listId})\n`);

    // ── STEP 2: READ SUBSCRIBERS ─ pick a real contact ───────────────────
    console.info('─'.repeat(60));
    console.info('STEP 2 — Read Subscribers   [mailchimp-get-list-members]');
    console.info('─'.repeat(60));

    const membersResult = await matimo.execute('mailchimp-get-list-members', {
      server_prefix: serverPrefix,
      list_id: listId,
      status: 'subscribed',
      count: 5,
      offset: 0,
    });
    const membersData = (membersResult as any).data || membersResult;

    if (!membersData.members || membersData.members.length === 0) {
      console.error('❌ No subscribed members found in this audience. Add a contact first.');
      process.exit(1);
    }

    console.info(`✅ ${membersData.total_items} total subscribed member(s) — showing up to 5:`);
    membersData.members.forEach((m: any) => console.info(`   • ${m.email_address} (${m.status})`));

    // Use the first real contact from the list — no fake emails needed
    const contact = membersData.members[0];
    const subscriberHash: string = contact.id;
    console.info(`\n   ➡️  Using contact: ${contact.email_address} (hash: ${subscriberHash})\n`);

    // ── STEP 3: UPDATE THE SUBSCRIBER ─────────────────────────────────────
    console.info('─'.repeat(60));
    console.info('STEP 3 — Update Subscriber   [mailchimp-update-list-member]');
    console.info('─'.repeat(60));

    try {
      const updateResult = await matimo.execute('mailchimp-update-list-member', {
        server_prefix: serverPrefix,
        list_id: listId,
        subscriber_hash: subscriberHash,
        status: 'subscribed',
        merge_fields: contact.merge_fields ?? {},
      });
      const updateData = (updateResult as any).data || updateResult;

      if (updateData.id || updateData.email_address) {
        console.info(`✅ Subscriber confirmed/updated:`);
        console.info(`   Email:  ${updateData.email_address}`);
        console.info(`   Status: ${updateData.status}\n`);
      } else {
        console.info(`⚠️  Update response: ${JSON.stringify(updateData)}\n`);
      }
    } catch (updateError) {
      const msg = updateError instanceof Error ? updateError.message : String(updateError);
      console.info(`⚠️  Update skipped: ${msg}`);
      console.info(`   (This contact may have merge field validation issues in Mailchimp.)\n`);
    }

    // ── STEP 4: CREATE A CAMPAIGN ─────────────────────────────────────────
    console.info('─'.repeat(60));
    console.info('STEP 4 — Create Campaign   [mailchimp-create-campaign]');
    console.info('─'.repeat(60));

    const campaignResult = await matimo.execute('mailchimp-create-campaign', {
      server_prefix: serverPrefix,
      type: 'regular',
      list_id: listId,
      subject_line: 'Welcome — created by Matimo',
      preview_text: 'This campaign was built automatically by the Matimo factory example.',
      title: `Matimo Factory Demo — ${new Date().toISOString().split('T')[0]}`,
      from_name: 'Matimo Demo',
      reply_to: contact.email_address,
    });
    const campaignData = (campaignResult as any).data || campaignResult;

    if (campaignData.id) {
      console.info(`✅ Campaign created (not sent):`);
      console.info(`   Campaign ID: ${campaignData.id}`);
      console.info(`   Status:      ${campaignData.status}`);
      console.info(`   Audience:    "${audience.name}"\n`);
    } else {
      console.info(`⚠️  Campaign response: ${JSON.stringify(campaignData)}\n`);
    }

    // ── NEXT STEPS (approval required) ───────────────────────────────────
    console.info('─'.repeat(60));
    console.info('NEXT STEPS  (these tools require approval flag: true)');
    console.info('─'.repeat(60));
    console.info(
      `   • Send campaign:     mailchimp-send-campaign   { campaign_id: "${campaignData.id ?? '<id>'}" }`
    );
    console.info(
      `   • Remove subscriber: mailchimp-remove-list-member  { list_id: "${listId}", subscriber_hash: "${subscriberHash}" }`
    );
    console.info();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.info('════════════════════════════════════════════════════════════');
  console.info('✨ Full CRUD Flow Complete!');
  console.info('════════════════════════════════════════════════════════════\n');
}

runMailchimpFactoryFlow().catch(console.error);
