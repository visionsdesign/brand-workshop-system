import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

/** Step 3 of an upload: record the stored file against the workshop */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token'), workshopId: body?.workshopId });
  if (!access) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const path = String(body?.path ?? '');
  if (!path.startsWith(`${access.workshop.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }
  const file = await portalStore().addFile({
    workshopId: access.workshop.id,
    name: String(body?.name ?? 'file').slice(0, 200),
    size: Number(body?.size ?? 0),
    type: String(body?.type ?? '').slice(0, 120),
    path,
    uploadedBy: access.by,
  });
  return NextResponse.json(file);
}
