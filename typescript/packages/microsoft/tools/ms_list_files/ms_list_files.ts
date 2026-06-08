/**
 * ms_list_files — GET /drives/{drive_id}/items/{item_id}/children
 * https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
 */
import { MatimoError, ErrorCode } from '@matimo/core';
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const DEFAULT_ITEM_ID = 'root';
const DEFAULT_TOP = 20;
const MAX_TOP = 100;

interface DriveItem {
  id?: string;
  name?: string;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: unknown;
}

interface ChildrenResponse {
  value?: DriveItem[];
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['drive_id'], 'ms_list_files');

  const driveId = String(params.drive_id);
  const itemId = typeof params.item_id === 'string' && params.item_id ? params.item_id : DEFAULT_ITEM_ID;

  const top = params.top === undefined ? DEFAULT_TOP : Number(params.top);
  if (!Number.isFinite(top) || top < 1 || top > MAX_TOP) {
    throw new MatimoError(
      `ms_list_files: 'top' must be a number between 1 and ${MAX_TOP} (received ${String(params.top)})`,
      ErrorCode.VALIDATION_FAILED,
      { top: params.top }
    );
  }

  const token = getAccessToken(context);

  const data = await graphRequest<ChildrenResponse>({
    method: 'GET',
    path: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children`,
    token,
    resourceType: 'Drive folder',
    query: {
      $top: top,
      $select: 'id,name,size,lastModifiedDateTime,webUrl,file,folder',
    },
  });

  const items = (data?.value ?? []).map((item) => ({
    id: item.id ?? '',
    name: item.name ?? '',
    type: item.folder ? 'folder' : 'file',
    size_bytes: item.size ?? 0,
    last_modified: item.lastModifiedDateTime ?? '',
    ...(item.file?.mimeType ? { mime_type: item.file.mimeType } : {}),
    web_url: item.webUrl ?? '',
  }));

  return {
    success: true,
    items,
  };
}
