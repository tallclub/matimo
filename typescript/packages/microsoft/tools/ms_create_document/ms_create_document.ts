/**
 * ms_create_document — PUT /drives/{drive-id}/items/{parent-item-id}:/{filename}:/content
 * https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
 *
 * Uses the "simple upload" by-path addressing syntax. Graph caps this endpoint at
 * 4 MB; larger files require a resumable upload session, which is out of scope here
 * and is rejected with a clear validation error rather than silently truncating.
 */
import { MatimoError, ErrorCode } from '@matimo/core/runtime';
import { getAccessToken, requireParams, graphRequest } from '../graph-client.js';

interface ToolContext {
  credentials?: Record<string, string>;
}

const VALID_ENCODINGS = ['text', 'base64'];
const VALID_CONFLICT_BEHAVIOURS = ['replace', 'rename', 'fail'];
const DEFAULT_PARENT_ITEM_ID = 'root';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

interface UploadedItem {
  id?: string;
  name?: string;
  webUrl?: string;
  size?: number;
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['drive_id', 'filename', 'content'], 'ms_create_document');

  const driveId = String(params.drive_id);
  const parentItemId =
    typeof params.parent_item_id === 'string' && params.parent_item_id
      ? params.parent_item_id
      : DEFAULT_PARENT_ITEM_ID;
  const filename = String(params.filename);

  const encoding = params.content_encoding === undefined ? 'text' : String(params.content_encoding);
  if (!VALID_ENCODINGS.includes(encoding)) {
    throw new MatimoError(
      `ms_create_document: 'content_encoding' must be one of ${VALID_ENCODINGS.join(', ')} (received '${encoding}')`,
      ErrorCode.VALIDATION_FAILED,
      { content_encoding: params.content_encoding }
    );
  }

  const conflictBehaviour =
    params.conflict_behaviour === undefined ? 'replace' : String(params.conflict_behaviour);
  if (!VALID_CONFLICT_BEHAVIOURS.includes(conflictBehaviour)) {
    throw new MatimoError(
      `ms_create_document: 'conflict_behaviour' must be one of ${VALID_CONFLICT_BEHAVIOURS.join(', ')} (received '${conflictBehaviour}')`,
      ErrorCode.VALIDATION_FAILED,
      { conflict_behaviour: params.conflict_behaviour }
    );
  }

  const buffer =
    encoding === 'base64'
      ? Buffer.from(String(params.content), 'base64')
      : Buffer.from(String(params.content), 'utf-8');

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new MatimoError(
      `ms_create_document: content is ${buffer.byteLength} bytes, exceeding the ` +
        `${MAX_UPLOAD_BYTES}-byte limit of the simple-upload endpoint. Files this large ` +
        'require a resumable upload session, which this tool does not implement.',
      ErrorCode.VALIDATION_FAILED,
      { sizeBytes: buffer.byteLength, maxBytes: MAX_UPLOAD_BYTES }
    );
  }

  const token = getAccessToken(context);

  // By-path addressing uses literal colons as delimiters — only the path SEGMENTS
  // (drive id, parent item id, filename) are percent-encoded, not the colons.
  const path =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}` +
    `:/${encodeURIComponent(filename)}:/content`;

  const item = await graphRequest<UploadedItem>({
    method: 'PUT',
    path,
    token,
    resourceType: 'Drive folder',
    query: { '@microsoft.graph.conflictBehavior': conflictBehaviour },
    body: buffer,
    headers: { 'Content-Type': 'application/octet-stream' },
  });

  return {
    success: true,
    item_id: item?.id ?? '',
    name: item?.name ?? filename,
    web_url: item?.webUrl ?? '',
    size_bytes: item?.size ?? buffer.byteLength,
  };
}
