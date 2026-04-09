/**
 * Example: Using Matimo with Winston Logger for Production
 * Demonstrates logging with different log levels and formats
 */

import { MatimoInstance } from '@matimo/core';

async function main() {
  // Initialize Matimo with debug logging
  const matimo = await MatimoInstance.init({
    toolPaths: ['./packages/slack/tools'],
    logLevel: 'debug',
    logFormat: 'json', // Use JSON for production
  });

  // Get the logger instance
  const logger = matimo.getLogger();

  // Log examples
  logger.info('User action initiated', {
    userId: 'user_123',
    action: 'list_tools',
  });

  logger.debug('Debug info for development', {
    toolCount: matimo.listTools().length,
  });

  logger.warn('Missing optional parameter', {
    param: 'message_blocks',
    using_fallback: true,
  });

  // List tools
  const tools = matimo.listTools();
  logger.info(`Found ${tools.length} tools`, { tools: tools.map((t) => t.name) });
}

// Run the example
main().catch(console.error);
