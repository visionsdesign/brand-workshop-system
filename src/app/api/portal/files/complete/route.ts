import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { markStarted, SLIDE_IDS } from '@/lib/portal/selfserve';
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
  // Voice notes are tied to a workshop slide and carry the browser's transcript
  const slideId = typeof body?.slideId === 'string' && SLIDE_IDS.has(body.slideId) ? body.slideId : null;
  const seconds = Number(body?.seconds);
  const file = await portalStore().addFile({
    workshopId: access.workshop.id,
    name: String(body?.name ?? 'file').slice(0, 200),
    size: Number(body?.size ?? 0),
    type: String(body?.type ?? '').slice(0, 120),
    path,
    uploadedBy: access.by,
    slideId,
    transcript: slideId && typeof body?.transcript === 'string' ? body.transcript.slice(0, 20000) : null,
    seconds: slideId && Number.isFinite(seconds) ? Math.round(seconds) : null,
  });
  if (slideId && access.by === 'client') await markStarted(access.workshop);
  return NextResponse.json(file);
}
