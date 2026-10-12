import { NextResponse } from 'next/server';
import { DriveError, driveAccountEmail, driveConfigured, folderIdFromUrl, folderName, isInsideFolder, listFolder } from '@/lib/portal/drive';
import { portalStore } from '@/lib/portal/store';
import { teamMember } from '@/lib/portal/team';

export const dynamic = 'force-dynamic';

/**
 * Team only: list the files in a workshop's Google Drive folder, or in a
 * subfolder of it (?folder=<id>). Never lists anything outside that folder.
 */
export async function GET(req: Request) {
  if (!(await teamMember())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!driveConfigured()) return NextResponse.json({ configured: false });

  const url = new URL(req.url);
  const w = await portalStore().getById(url.searchParams.get('workshopId') ?? '');
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const root = folderIdFromUrl(w.driveFolderUrl);
  if (!root) return NextResponse.json({ configured: true, account: driveAccountEmail(), error: 'Add a Google Drive folder link to this workshop first.' });

  const sub = url.searchParams.get('folder');
  try {
    if (sub && sub !== root && !(await isInsideFolder(sub, root))) {
      return NextResponse.json({ error: 'That folder is outside this workshop’s Drive folder.' }, { status: 403 });
    }
    const id = sub || root;
    const [name, files] = await Promise.all([folderName(id), listFolder(id)]);
    return NextResponse.json({ configured: true, account: driveAccountEmail(), root, folder: { id, name }, files });
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ configured: true, account: driveAccountEmail(), error: err.message });
    console.error('drive list failed', err);
    return NextResponse.json({ configured: true, account: driveAccountEmail(), error: 'Google Drive could not be reached. Try again.' });
  }
}
