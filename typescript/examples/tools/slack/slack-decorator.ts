#!/usr/bin/env node
/**
 * ============================================================================
 * SLACK TOOLS - DECORATOR PATTERN EXAMPLE
 * ============================================================================
 *
 * PATTERN: Decorator Pattern with @tool
 * ─────────────────────────────────────────────────────────────────────────
 * Uses TypeScript @tool decorators to wrap Slack tool calls in a class.
 *
 * Use this pattern when:
 * ✅ Building class-based applications
 * ✅ Encapsulating tool logic in services
 * ✅ Adding custom methods that combine multiple tools
 * ✅ Need reusable tool wrappers
 * ✅ Object-oriented design preferred
 *
 * SETUP:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Create .env file:
 *    SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxx
 *
 * 2. Same scopes as factory pattern
 *
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────
 *   export SLACK_BOT_TOKEN=your_token_here
 *   npm run slack:decorator
 *
 * ============================================================================
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatimoInstance, tool, setGlobalMatimoInstance } from 'matimo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Decorator Pattern Agent - Uses @tool decorators for Slack operations
 */
class SlackDecoratorPatternAgent {
  constructor(private matimo: MatimoInstance) {}

  /**
   * Slack send-message tool - manually execute with only required parameters
   */
  async sendMessage(channel: string, text: string): Promise<unknown> {
    // Manually execute to avoid sending undefined parameters
    const result = await this.matimo.execute('slack-send-message', {
      channel,
      text,
    });
    return result;
  }

  /**
   * Slack list-channels tool - automatically executes via @tool decorator
   */
  @tool('slack-list-channels')
  async listChannels(types?: string, limit?: number): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('slack-list-channels', { types, limit })
    return undefined;
  }

  /**
   * Slack get-channel-history tool - automatically executes via @tool decorator
   */
  @tool('slack_get_channel_history')
  async getChannelHistory(channel: string, limit?: number): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('slack_get_channel_history', { channel, limit })
    return undefined;
  }

  /**
   * Slack add-reaction tool - automatically executes via @tool decorator
   */
  @tool('slack_add_reaction')
  async addReaction(channel: string, timestamp: string, name: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('slack_add_reaction', { channel, timestamp, name })
    return undefined;
  }

  /**
   * Slack create-channel tool - automatically executes via @tool decorator
   */
  @tool('slack_create_channel')
  async createChannel(name: string, is_private?: boolean): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('slack_create_channel', { name, is_private })
    return undefined;
  }

  /**
   * Slack set-channel-topic tool - automatically executes via @tool decorator
   */
  @tool('slack_set_channel_topic')
  async setChannelTopic(channel: string, topic: string): Promise<unknown> {
    // Decorator automatically calls: matimo.execute('slack_set_channel_topic', { channel, topic })
    return undefined;
  }
}

/**
 * Run decorator pattern examples
 */
async function runDecoratorPatternExamples() {
  const botToken = process.env.SLACK_BOT_TOKEN || 'xoxb-default-fake-token';

  console.info('╔════════════════════════════════════════════════════════╗');
  console.info('║     Slack Tools - Decorator Pattern                    ║');
  console.info('║     (Uses @tool decorators for automatic execution)    ║');
  console.info('╚════════════════════════════════════════════════════════╝\n');

  if (botToken === 'xoxb-default-fake-token') {
    console.info('🔐 Warning: SLACK_BOT_TOKEN not set in environment');
    console.info('   Set it: export SLACK_BOT_TOKEN="xoxb-xxxx"');
    console.info('   Get one from: https://api.slack.com/apps\n');
  }

  console.info(`🤖 Slack Bot Token: ${botToken.substring(0, 10)}...\n`);

  try {
    // Initialize Matimo with auto-discovery
    console.info('🚀 Initializing Matimo...');
    const matimo = await MatimoInstance.init({ autoDiscover: true });
    setGlobalMatimoInstance(matimo);

    const matimoTools = matimo.listTools();
    const slackTools = matimoTools.filter((t) => t.name.startsWith('slack'));
    console.info(`📦 Loaded ${matimoTools.length} total tools, ${slackTools.length} Slack tools\n`);

    // Create agent
    const agent = new SlackDecoratorPatternAgent(matimo);

    console.info('🧪 Testing Slack Tools with Decorator Pattern');
    console.info('═'.repeat(60) + '\n');

    // Example 1: List channels
    console.info('📋 Example 1: List Available Channels');
    console.info('─'.repeat(60));
    try {
      const listResult = await agent.listChannels('public_channel,private_channel', 100);

      const listData = (listResult as any).data || listResult;

      if (listData.ok === true && listData.channels && Array.isArray(listData.channels)) {
        const channels = listData.channels;
        console.info(`✅ Found ${channels.length} channels:`);
        channels.slice(0, 5).forEach((ch: any, idx: number) => {
          console.info(`   ${idx + 1}. #${ch.name} (ID: ${ch.id})`);
        });
        if (channels.length > 5) {
          console.info(`   ... and ${channels.length - 5} more`);
        }

        // Use first available channel for next examples
        const firstChannel = channels[0];
        console.info(`\n🎯 Using first channel: #${firstChannel.name} (${firstChannel.id})\n`);

        // Example 2: Send message
        console.info('💬 Example 2: Send Message to Channel');
        console.info('─'.repeat(60));
        try {
          const sendResult = await agent.sendMessage(
            firstChannel.id,
            `👋 Hello from Matimo! Decorator pattern test at ${new Date().toISOString()}`
          );

          const sendData = (sendResult as any).data || sendResult;
          if (sendData.ok === true) {
            console.info('✅ Message sent successfully!');
            if (sendData.ts) console.info(`   Timestamp: ${sendData.ts}`);
            if (sendData.channel) console.info(`   Channel: ${sendData.channel}`);
          } else {
            console.info(`❌ Failed: ${sendData.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Example 3: Get channel history
        console.info('\n📜 Example 3: Get Channel History');
        console.info('─'.repeat(60));
        try {
          const historyResult = await agent.getChannelHistory(firstChannel.id, 5);

          const historyData = (historyResult as any).data || historyResult;
          if (
            historyData.ok === true &&
            historyData.messages &&
            Array.isArray(historyData.messages)
          ) {
            console.info(
              `✅ Retrieved ${historyData.messages.length} messages from #${firstChannel.name}`
            );
            historyData.messages.slice(0, 3).forEach((msg: any, idx: number) => {
              console.info(`   ${idx + 1}. "${msg.text?.substring(0, 50)}..." (${msg.ts})`);
            });
          } else {
            console.info(`❌ Failed: ${historyData.error || 'No messages found'}`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Example 4: Set channel topic
        console.info('\n🏷️  Example 4: Set Channel Topic');
        console.info('─'.repeat(60));
        try {
          const topicResult = await agent.setChannelTopic(
            firstChannel.id,
            '🎯 Matimo Testing Channel - Decorator Pattern Example'
          );

          const topicData = (topicResult as any).data || topicResult;
          if (topicData.ok === true) {
            console.info('✅ Channel topic updated successfully!');
          } else {
            console.info(`❌ Failed: ${topicData.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.info(`❌ Failed to list channels: ${listData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.info(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.info('\n' + '═'.repeat(60));
    console.info('✨ Decorator Pattern Example Complete!');
    console.info('═'.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
runDecoratorPatternExamples().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
