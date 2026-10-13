import { NextResponse } from 'next/server';
import { DriveError, downloadFile, driveConfigured, folderIdFromUrl, isInsideFolder } from '@/lib/portal/drive';
import { syncLater } from '@/lib/portal/drive-sync';
import { portalStore } from '@/lib/portal/store';
import { teamMember } from '@/lib/portal/team';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Team only: copy a file from the workshop's Drive folder into its workshop files */
export async function POST(req: Request) {
  if (!(await teamMember())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!driveConfigured()) return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const store = portalStore();
  const w = await store.getById(String(body?.workshopId ?? ''));
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const root = folderIdFromUrl(w.driveFolderUrl);
  const fileId = String(body?.fileId ?? '');
  if (!root || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  try {
    if (!(await isInsideFolder(fileId, root))) {
      return NextResponse.json({ error: 'That file is outside this workshop’s Drive folder.' }, { status: 403 });
    }
    const { bytes, name, type } = await downloadFile(fileId);
    const path = await store.putFile(w.id, name, bytes, type);
    const file = await store.addFile({
      workshopId: w.id, name, size: bytes.byteLength, type, path, uploadedBy: 'team', slideId: null, transcript: null, seconds: null,
    });
    syncLater(w.id);
    return NextResponse.json(file);
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('drive import failed', err);
    return NextResponse.json({ error: 'The import did not work. Please try again.' }, { status: 502 });
  }
}
