import { MatimoInstance, setGlobalMatimoInstance, tool } from '@matimo/core';

/**
 * Example: Web tool using @tool decorator pattern
 * Demonstrates class-based HTTP requests with automatic decoration
 */
class WebClient {
  @tool('web')
  async fetchUrl(url: string, timeout?: number): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }

  @tool('web')
  async postData(url: string, body: string, headers?: Record<string, string>): Promise<unknown> {
    // Decorator automatically intercepts and executes via Matimo
    return undefined;
  }
}

async function decoratorExample() {
  // Set up decorator support with autoDiscover
  const matimo = await MatimoInstance.init({ autoDiscover: true });
  setGlobalMatimoInstance(matimo);

  console.info('=== Web Tool - Decorator Pattern ===\n');

  const client = new WebClient();

  try {
    // Example 1: Fetch through decorated method
    console.info('1. Fetching content via decorator\n');
    const result1 = await client.fetchUrl('https://api.github.com/repos/tallclub/matimo');
    console.info('Status:', (result1 as any).statusCode);
    console.info('Size:', (result1 as any).contentLength);
    console.info('---\n');

    // Example 2: POST through decorated method
    console.info('2. Posting data via decorator\n');
    const result2 = await client.postData(
      'https://httpbin.org/post',
      JSON.stringify({ test: 'data' }),
      { 'Content-Type': 'application/json' }
    );
    console.info('Status:', (result2 as any).statusCode);
    console.info('---\n');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

decoratorExample();
