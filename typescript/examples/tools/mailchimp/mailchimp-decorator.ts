#!/usr/bin/env node
/**
 * ============================================================================
 * MAILCHIMP TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern — Complete CRUD Workflow
 * ─────────────────────────────────────────────────────────────────────────
 * Same end-to-end flow as the factory example, but using TypeScript @tool
 * decorators on a class. The decorator intercepts each method call and
 * routes it through MatimoInstance automatically.
 *
 * FLOW:
 *   1. GET    — Fetch audiences, pick the first one automatically
 *   2. READ   — List subscribers, pick the first real contact
 *   3. UPDATE — Update that contact's name
 *   4. CREATE — Build a campaign targeting the audience
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 *   export MAILCHIMP_API_KEY=abc123def456-us6
 *   pnpm mailchimp:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

class MailchimpAgent {
  constructor(private readonly sp: string) {}

  @tool('mailchimp-get-lists')
  async getLists(server_prefix: string, count?: number): Promise<unknown> {
    // Decorator auto-executes via matimo
    return undefined;
  }

  @tool('mailchimp-add-list-member')
  async addMember(
    server_prefix: string,
    list_id: string,
    email_address: string,
    status: string,
    merge_fields?: Record<string, string>,
    tags?: string[]
  ): Promise<unknown> {
    // Decorator auto-executes via matimo
    return undefined;
  }

  @tool('mailchimp-get-list-members')
  async getMembers(
    server_prefix: string,
    list_id: string,
    status?: string,
    count?: number,
    offset?: number
  ): Promise<unknown> {
    // Decorator auto-executes via matimo
    return undefined;
  }

  @tool('mailchimp-update-list-member')
  async updateMember(
    server_prefix: string,
    list_id: string,
    subscriber_hash: string,
    merge_fields?: Record<string, string>
  ): Promise<unknown> {
    // Decorator auto-executes via matimo
    return undefined;
  }

  @tool('mailchimp-create-campaign')
  async createCampaign(
    server_prefix: string,
    type: string,
    list_id: string,
    subject_line: string,
    preview_text?: string,
    title?: string,
    from_name?: string,
    reply_to?: string
  ): Promise<unknown> {
    // Decorator auto-executes via matimo
    return undefined;
  }

  // ── Convenience helpers that bind server_prefix automatically ────────────

  async fetchAudiences(count = 10) {
    return this.getLists(this.sp, count);
  }

  async subscribe(
    listId: string,
    email: string,
    firstName: string,
    lastName: string,
    tags: string[]
  ) {
    return this.addMember(
      this.sp,
      listId,
      email,
      'subscribed',
      { FNAME: firstName, LNAME: lastName },
      tags
    );
  }

  async listSubscribers(listId: string, count = 5) {
    return this.getMembers(this.sp, listId, 'subscribed', count, 0);
  }

  async patchMember(listId: string, hash: string, mergeFields: Record<string, string>) {
    return this.updateMember(this.sp, listId, hash, mergeFields);
  }

  async buildCampaign(listId: string, subjectLine: string, fromName: string, replyTo: string) {
    return this.createCampaign(
      this.sp,
      'regular',
      listId,
      subjectLine,
      'Built automatically by Matimo decorator example.', // preview_text
      `Matimo Decorator Demo — ${new Date().toISOString().split('T')[0]}`, // title
      fromName, // from_name
      replyTo // reply_to
    );
  }
}

async function runMailchimpDecoratorFlow() {
  console.info('\n╔════════════════════════════════════════════════════════╗');
  console.info('║   Mailchimp - Decorator Pattern (Full CRUD Flow)       ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    console.error('❌ MAILCHIMP_API_KEY not set.');
    console.info('   export MAILCHIMP_API_KEY="abc123def456-us6"');
    process.exit(1);
  }

  const serverPrefix = apiKey.split('-').pop()!;
  console.info(`🔑 API Key is configured.. 📍 Server \n`);

  console.info('🚀 Initializing Matimo...');
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  setGlobalMatimoInstance(matimo);
  console.info(
    `✅ ${matimo.listTools().filter((t) => t.name.startsWith('mailchimp-')).length} Mailchimp tools loaded\n`
  );

  const agent = new MailchimpAgent(serverPrefix);

  try {
    // ── STEP 1: GET AUDIENCES ─────────────────────────────────────────────
    console.info('─'.repeat(60));
    console.info('STEP 1 — Get Audiences   [@tool: mailchimp-get-lists]');
    console.info('─'.repeat(60));

    const listsResult = await agent.fetchAudiences();
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

    const audience = listsData.lists[0];
    const listId: string = audience.id;
    console.info(`\n   ➡️  Using: "${audience.name}" (${listId})\n`);

    // ── STEP 2: READ SUBSCRIBERS ─ pick a real contact ───────────────────
    console.info('─'.repeat(60));
    console.info('STEP 2 — Read Subscribers   [@tool: mailchimp-get-list-members]');
    console.info('─'.repeat(60));

    const membersResult = await agent.listSubscribers(listId, 5);
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

    // ── STEP 3: UPDATE THE SUBSCRIBER ──────────────────────────────────────────
    console.info('─'.repeat(60));
    console.info('STEP 3 — Update Subscriber   [@tool: mailchimp-update-list-member]');
    console.info('─'.repeat(60));

    try {
      const updateResult = await agent.patchMember(
        listId,
        subscriberHash,
        contact.merge_fields ?? {}
      );
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
    console.info('STEP 4 — Create Campaign   [@tool: mailchimp-create-campaign]');
    console.info('─'.repeat(60));

    const campaignResult = await agent.buildCampaign(
      listId,
      'Welcome — created by Matimo Decorator',
      'Matimo Demo',
      contact.email_address
    );
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
    console.info('NEXT STEPS  (these tools require requires_approval: true)');
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

runMailchimpDecoratorFlow().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
