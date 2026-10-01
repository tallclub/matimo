/**
 * ============================================================================
 * RESPONSE SIZE GUARDRAIL — keep huge tool results out of the model's context
 * ============================================================================
 *
 * Every result is measured as serialized UTF-8 JSON. Over the limit, arrays
 * and strings are cut down in place with an inline "...truncated" marker,
 * and the top-level object gains `_truncated: true`, so the model knows it
 * saw only part of the data.
 *
 * The limit, most specific first:
 *   output_schema.max_response_size   in the tool's YAML
 *   defaultMaxResponseSize            in MatimoInstance.init()
 *   DEFAULT_MAX_RESPONSE_SIZE_BYTES   built in
 *
 * No API keys needed. Calls the public JSONPlaceholder test API, whose
 * /posts endpoint returns 100 posts (about 27 KB).
 *
 * Run: pnpm policy:response-size
 * ============================================================================
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MatimoInstance } from '@matimo/core';

const tool = (name: string, extra = '') => `name: ${name}
version: '1.0.0'
description: List every post
execution:
  type: http
  method: GET
  url: 'https://jsonplaceholder.typicode.com/posts'
${extra}`;

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf-8');

async function main(): Promise<void> {
  const toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matimo-size-'));
  const write = (name: string, yaml: string) => {
    fs.mkdirSync(path.join(toolsDir, name));
    fs.writeFileSync(path.join(toolsDir, name, 'definition.yaml'), yaml);
  };
  write('list_posts', tool('list_posts'));
  write(
    'list_posts_small',
    tool('list_posts_small', 'output_schema:\n  type: object\n  max_response_size: 3000\n')
  );

  try {
    const matimo = await MatimoInstance.init({
      toolPaths: [toolsDir],
      logLevel: 'silent',
      defaultMaxResponseSize: 6000, // for tools that don't set their own
    });

    for (const name of ['list_posts', 'list_posts_small']) {
      const result = (await matimo.execute(name, {})) as {
        data: unknown[];
        _truncated?: boolean;
      };
      const kept = result.data.filter((item) => typeof item === 'object').length;
      console.info(`\n${name}`);
      console.info(`   size: ${bytes(result)} bytes, _truncated: ${result._truncated === true}`);
      console.info(`   posts kept: ${kept}`);
      console.info(`   marker: ${JSON.stringify(result.data[result.data.length - 1])}`);
    }
    console.info('');
  } finally {
    fs.rmSync(toolsDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
