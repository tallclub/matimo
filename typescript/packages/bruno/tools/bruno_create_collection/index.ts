import { getGlobalMatimoLogger } from '@matimo/core/runtime';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = getGlobalMatimoLogger();

export default async function execute(params: Record<string, unknown>): Promise<unknown> {
  const collectionPath = params.collection_path as string;
  const collectionName = params.collection_name as string;

  if (!collectionPath || !collectionName) {
    return {
      success: false,
      collection_path: '',
      message: 'collection_path and collection_name parameters are required',
      errors: ['collection_path and collection_name parameters are required'],
    };
  }

  try {
    logger.info(`Creating collection: ${collectionName} at ${collectionPath}`);

    const absolutePath = path.resolve(collectionPath);
    await fs.mkdir(absolutePath, { recursive: true });

    const brunoJson = {
      version: '1',
      name: collectionName,
      type: 'collection',
      ignore: [] as string[],
    };

    const brunoJsonPath = path.join(absolutePath, 'bruno.json');
    await fs.writeFile(brunoJsonPath, JSON.stringify(brunoJson, null, 2), 'utf-8');

    logger.info('Collection created successfully');

    return {
      success: true,
      collection_path: absolutePath,
      message: `Collection "${collectionName}" created at ${absolutePath}`,
      errors: [],
    };
  } catch (error) {
    logger.error(
      `Create collection failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      collection_path: collectionPath,
      message: 'Collection creation failed',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
