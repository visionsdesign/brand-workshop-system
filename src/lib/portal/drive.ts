// Read-only Google Drive access for the team area, through a service account.
// Share the clients' parent Drive folder with GOOGLE_SERVICE_ACCOUNT_EMAIL once;
// every client folder inside it can then be listed and imported.
import { JWT } from 'google-auth-library';

const API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_MAX_BYTES = 50 * 1024 * 1024;

export const driveConfigured = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
export const driveAccountEmail = () => process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';

let jwt: JWT | null = null;
async function token(): Promise<string> {
  jwt ??= new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Env files and Netlify store the key's newlines as literal \n
    key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const { token: t } = await jwt.getAccessToken();
  if (!t) throw new Error('No Google access token');
  return t;
}

export class DriveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function drive(path: string, params: Record<string, string>) {
  const url = `${API}${path}?${new URLSearchParams({ supportsAllDrives: 'true', ...params })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` }, cache: 'no-store' });
  if (res.status === 404 || res.status === 403) {
    throw new DriveError(
      `We can't see this folder. Share it (or a folder above it) with ${driveAccountEmail()} as a Viewer.`,
      res.status,
    );
  }
  if (!res.ok) throw new DriveError(`Google Drive returned an error (${res.status}).`, res.status);
  return res;
}

/** Folder ID from the links people paste: /drive/folders/<id>, /drive/u/0/folders/<id>, ?id=<id> */
export function folderIdFromUrl(url: string): string | null {
  const m = url.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  webViewLink: string;
  isFolder: boolean;
  /** Google Docs/Sheets/Slides are exported on import */
  exportAs: { mimeType: string; ext: string } | null;
}

const EXPORTS: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.drawing': { mimeType: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  },
};
const FOLDER = 'application/vnd.google-apps.folder';

const toFile = (f: Record<string, string>): DriveFile => ({
  id: f.id,
  name: f.name,
  mimeType: f.mimeType,
  size: f.size ? Number(f.size) : null,
  modifiedTime: f.modifiedTime,
  webViewLink: f.webViewLink,
  isFolder: f.mimeType === FOLDER,
  exportAs: EXPORTS[f.mimeType] ?? null,
});

export async function folderName(id: string): Promise<string> {
  const res = await drive(`/files/${id}`, { fields: 'id,name,mimeType' });
  const f = await res.json();
  if (f.mimeType !== FOLDER) throw new DriveError('That link is to a file, not a folder.', 400);
  return f.name;
}

/** Files directly inside a folder: folders first, then by name */
export async function listFolder(id: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const res = await drive('/files', {
      q: `'${id}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink)',
      orderBy: 'folder,name',
      pageSize: '200',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await res.json();
    out.push(...(data.files ?? []).map(toFile));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken && out.length < 1000);
  return out;
}

/** Is this file inside the given folder (directly or below)? Stops imports reaching outside the client's folder. */
export async function isInsideFolder(fileId: string, folderId: string): Promise<boolean> {
  let current = fileId;
  for (let depth = 0; depth < 10; depth++) {
    const res = await drive(`/files/${current}`, { fields: 'parents' });
    const parents: string[] = (await res.json()).parents ?? [];
    if (parents.includes(folderId)) return true;
    if (!parents.length) return false;
    current = parents[0];
  }
  return false;
}

/** Download a Drive file, exporting Google formats; returns the bytes and the name to save under */
export async function downloadFile(fileId: string): Promise<{ bytes: Uint8Array; name: string; type: string }> {
  const meta = toFile(await (await drive(`/files/${fileId}`, { fields: 'id,name,mimeType,size,modifiedTime,webViewLink' })).json());
  if (meta.isFolder) throw new DriveError('Folders cannot be imported. Open it and import the files inside.', 400);
  if (meta.size && meta.size > DRIVE_MAX_BYTES) throw new DriveError('That file is over 50 MB.', 413);
  const res = meta.exportAs
    ? await drive(`/files/${fileId}/export`, { mimeType: meta.exportAs.mimeType })
    : await drive(`/files/${fileId}`, { alt: 'media' });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > DRIVE_MAX_BYTES) throw new DriveError('That file is over 50 MB.', 413);
  const name = meta.exportAs && !meta.name.toLowerCase().endsWith(`.${meta.exportAs.ext}`) ? `${meta.name}.${meta.exportAs.ext}` : meta.name;
  return { bytes, name, type: meta.exportAs?.mimeType ?? meta.mimeType };
}
