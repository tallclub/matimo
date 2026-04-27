import { getGlobalMatimoLogger } from '@matimo/core';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

function generateBruContent(params: Record<string, unknown>): string {
  const requestName = params.request_name as string;
  const method = (params.method as string).toLowerCase();
  const url = params.url as string;
  const headers = (params.headers as Record<string, string>) || {};
  const body = params.body as string | undefined;
  const tests = params.tests as string | undefined;
  const documentation = params.documentation as string | undefined;

  let content = '';

  content += `meta {\n  name: ${requestName}\n  type: http\n  seq: 1\n}\n\n`;

  if (documentation) {
    content += `docs {\n  ${documentation}\n}\n\n`;
  }

  content += `${method} {\n  url: ${url}\n  body: ${body ? 'json' : 'none'}\n  auth: inherit\n}\n\n`;

  if (Object.keys(headers).length > 0) {
    content += `headers {\n`;
    for (const [k, v] of Object.entries(headers)) {
      content += `  ${k}: ${v}\n`;
    }
    content += `}\n\n`;
  }

  if (body) {
    content += `body:json {\n`;
    content += body
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    content += `\n}\n\n`;
  }

  if (tests) {
    content += `tests {\n`;
    content += tests
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    content += `\n}\n`;
  }

  return content;
}

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;
  const requestName = params.request_name as string;

  if (!collectionPath || !requestName) {
    return {
      success: false,
      request_path: '',
      request_name: '',
      message: 'collection_path and request_name are required',
    };
  }

  try {
    logger.info(`Adding request ${requestName} to collection at ${collectionPath}`);

    const absoluteCollectionPath = path.resolve(collectionPath);
    await fs.mkdir(absoluteCollectionPath, { recursive: true });

    const filename = `${requestName.toLowerCase().replace(/\s+/g, '-')}.bru`;
    const requestPath = path.join(absoluteCollectionPath, filename);

    const content = generateBruContent(params);
    await fs.writeFile(requestPath, content, 'utf-8');

    logger.info(`Request written to ${requestPath}`);

    return {
      success: true,
      request_path: requestPath,
      request_name: requestName,
      message: `Request '${requestName}' added to collection successfully`,
    };
  } catch (error) {
    logger.error(
      `Add request failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      request_path: '',
      request_name: requestName,
      message: `Failed to add request: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
