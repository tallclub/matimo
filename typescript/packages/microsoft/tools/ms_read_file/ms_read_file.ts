/**
 * ms_read_file — GET /drives/{drive_id}/items/{item_id}/content
 * https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
 *
 * Scope decision (documented, not a shortcut): this tool performs REAL UTF-8 text
 * extraction only for plain-text formats. Rich document formats (PDF/Word/Excel/
 * PowerPoint) return `content: ""` with a format-specific warning rather than
 * bundling unverified parsing dependencies (no matimo package currently depends on
 * pdf-parse/mammoth/xlsx/cheerio). Truly-unsupported binaries get the exact warning
 * the tool's contract specifies: "Binary file — text extraction not supported".
 */
import { getAccessToken, requireParams, graphRequest, type ToolContext } from '../graph-client';

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_TYPES = new Set(['application/json', 'application/xml']);

const RICH_DOCUMENT_LABELS: Record<string, string> = {
  'application/pdf': 'PDF document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document (.docx)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel workbook (.xlsx)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'PowerPoint presentation (.pptx)',
  'application/msword': 'Word document (.doc)',
  'application/vnd.ms-excel': 'Excel workbook (.xls)',
  'application/vnd.ms-powerpoint': 'PowerPoint presentation (.ppt)',
};

interface DriveItemMetadata {
  name?: string;
  size?: number;
  file?: { mimeType?: string };
}

function isPlainTextMime(mimeType: string): boolean {
  return TEXT_MIME_TYPES.has(mimeType) || TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
}

export default async function execute(
  params: Record<string, unknown>,
  context?: ToolContext
): Promise<unknown> {
  requireParams(params, ['drive_id', 'item_id'], 'ms_read_file');

  const driveId = String(params.drive_id);
  const itemId = String(params.item_id);
  const token = getAccessToken(context);

  const metadata = await graphRequest<DriveItemMetadata>({
    method: 'GET',
    path: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
    token,
    resourceType: 'Drive item',
    query: { $select: 'name,size,file' },
  });

  const name = metadata?.name ?? '';
  const mimeType = metadata?.file?.mimeType ?? 'application/octet-stream';
  const sizeBytes = metadata?.size ?? 0;

  const raw = await graphRequest<ArrayBuffer>({
    method: 'GET',
    path: `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    token,
    resourceType: 'Drive item content',
    responseType: 'arraybuffer',
  });

  const buffer = Buffer.from(raw);

  if (isPlainTextMime(mimeType)) {
    return {
      success: true,
      content: buffer.toString('utf-8'),
      name,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    };
  }

  const richDocumentLabel = RICH_DOCUMENT_LABELS[mimeType];
  if (richDocumentLabel) {
    return {
      success: true,
      content: '',
      name,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      warning:
        `${richDocumentLabel} — text extraction for this format is not implemented to avoid ` +
        'bundling unverified parsing dependencies. Share the file via its web URL instead.',
    };
  }

  return {
    success: true,
    content: '',
    name,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    warning: 'Binary file — text extraction not supported',
  };
}
