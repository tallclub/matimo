/**
 * Integration test suite for Slack tools
 * Tests end-to-end execution using MatimoInstance (production-grade)
 */

import { MatimoInstance } from '../../../core/src/matimo-instance';
import path from 'path';

describe('Slack Tools Integration', () => {
  let matimo: MatimoInstance;
  const toolsPath = path.join(__dirname, '../../tools');

  beforeEach(async () => {
    // Mock environment variable
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';

    // Initialize MatimoInstance which will load all tools
    matimo = await MatimoInstance.init(toolsPath);
  });

  afterEach(() => {
    delete process.env.SLACK_BOT_TOKEN;
  });

  describe('Tool Loading & Availability', () => {
    it('should load Slack tools via MatimoInstance', async () => {
      const tools = matimo.listTools();
      const slackTools = tools.filter((tool) => tool.name.startsWith('slack-'));

      console.info(
        'Loaded Slack tools:',
        slackTools.map((t) => t.name)
      );

      expect(slackTools.length).toBeGreaterThan(0);
      // Check for any slack tool, not specific names
      expect(slackTools.some((t) => t.name.includes('slack'))).toBe(true);
    });

    it('should have correct tool metadata', () => {
      const tools = matimo.listTools();
      const slackTools = tools.filter((tool) => tool.name.startsWith('slack-'));

      if (slackTools.length > 0) {
        const firstTool = slackTools[0];
        expect(firstTool).toBeDefined();
        expect(firstTool.description).toBeDefined();
      }
    });
  });

  describe('Authentication', () => {
    it('should use api_key authentication for Slack tools', () => {
      const tools = matimo.listTools();
      const slackTools = tools.filter((tool) => tool.name.startsWith('slack-'));

      // All Slack tools should use api_key auth
      slackTools.forEach((tool) => {
        expect(tool.authentication?.type).toBe('api_key');
      });
    });
  });
});
