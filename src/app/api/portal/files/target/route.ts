import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { MAX_FILE_BYTES, portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

/** Step 1 of an upload: where should the browser send the bytes? */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token'), workshopId: body?.workshopId });
  if (!access) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const name = String(body?.name ?? '').slice(0, 200);
  const size = Number(body?.size ?? 0);
  if (!name) return NextResponse.json({ error: 'missing name' }, { status: 400 });
  if (!(size > 0) || size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `Files must be under ${MAX_FILE_BYTES / 1024 / 1024} MB.` }, { status: 413 });
  }
  const target = await portalStore().uploadTarget(access.workshop.id, name);
  return NextResponse.json({ ...target, workshopId: access.workshop.id });
}
