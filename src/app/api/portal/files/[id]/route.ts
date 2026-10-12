import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

async function load(req: Request, id: string) {
  const store = portalStore();
  const file = await store.getFile(id);
  if (!file) return null;
  const url = new URL(req.url);
  const token = req.headers.get('x-workshop-token') ?? url.searchParams.get('t');
  const access = await resolveAccess({ token, workshopId: file.workshopId });
  if (!access || access.workshop.id !== file.workshopId) return null;
  return { store, file, access };
}

/** Download. Clients pass their link token as ?t=, the team uses their session. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await load(req, (await params).id);
  if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const res = await found.store.download(found.file);
  if ('url' in res) return NextResponse.redirect(res.url);
  return new NextResponse(Buffer.from(res.bytes), {
    headers: {
      'Content-Type': found.file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(found.file.name)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await load(req, (await params).id);
  if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // Clients can remove their own uploads; the team can remove anything
  if (found.access.by === 'client' && found.file.uploadedBy !== 'client') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await found.store.deleteFile(found.file.id);
  return NextResponse.json({ ok: true });
}
