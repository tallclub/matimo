import { MatimoInstance } from '@matimo/core';

/**
 * Example: Web tool using factory pattern
 * Demonstrates making HTTP requests and fetching web content
 */
async function webExample() {
  // Initialize Matimo with autoDiscover to find all tools (core + providers)
  const matimo = await MatimoInstance.init({ autoDiscover: true });

  console.info('=== Web Tool - Factory Pattern ===\n');

  try {
    // Example 1: Fetch GitHub API
    console.info('1. Fetching GitHub API (public endpoint)\n');
    const github = await matimo.execute('web', {
      url: 'https://api.github.com/repos/tallclub/matimo',
    });

    console.info('Status Code:', (github as any).statusCode);
    console.info('Content size:', (github as any).size);
    // Content is already parsed as an object
    const githubData =
      typeof (github as any).content === 'string'
        ? JSON.parse((github as any).content)
        : (github as any).content;
    console.info('Repository:', githubData.full_name);
    console.info('Description:', githubData.description);
    console.info('---\n');

    // Example 2: Fetch HTML content
    console.info('2. Fetching HTML content\n');
    const html = await matimo.execute('web', {
      url: 'https://www.example.com',
      timeout: 15000,
    });

    console.info('Status Code:', (html as any).statusCode);
    console.info('Content type:', (html as any).contentType);
    console.info('Content size:', (html as any).size);
    const htmlContent =
      typeof (html as any).content === 'string'
        ? (html as any).content
        : JSON.stringify((html as any).content);
    console.info('Content preview:');
    console.info(htmlContent.substring(0, 200));
    console.info('---\n');

    // Example 3: POST request
    console.info('3. POST request (echo service)\n');
    const post = await matimo.execute('web', {
      url: 'https://httpbin.org/post',
      method: 'POST',
      body: JSON.stringify({ message: 'Hello from Matimo' }),
      headers: { 'Content-Type': 'application/json' },
    });

    console.info('Status Code:', (post as any).statusCode);
    const postContent =
      typeof (post as any).content === 'string'
        ? (post as any).content
        : JSON.stringify((post as any).content);
    console.info('Response:', postContent.substring(0, 200));
    console.info('---\n');
  } catch (error: any) {
    console.error('Error fetching web content:', error.message);
  }
}

webExample();
