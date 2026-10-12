import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { MAX_FILE_BYTES, portalStore, usingSupabase } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

/** Step 2 of an upload when running without Supabase: the bytes, stored under .data/files */
export async function PUT(req: Request) {
  if (usingSupabase()) return NextResponse.json({ error: 'not available' }, { status: 404 });
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token'), workshopId: url.searchParams.get('workshopId') });
  if (!access) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!path.startsWith(`${access.workshop.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
  await portalStore().writeLocal(path, bytes);
  return NextResponse.json({ ok: true });
}
