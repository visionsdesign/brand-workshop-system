import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { markStarted, SLIDE_IDS } from '@/lib/portal/selfserve';
import { portalStore } from '@/lib/portal/store';
import { transcribe } from '@/lib/portal/voice';
import { syncLater } from '@/lib/portal/drive-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Step 3 of an upload: record the stored file against the workshop */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token'), workshopId: body?.workshopId });
  if (!access) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const path = String(body?.path ?? '');
  if (!path.startsWith(`${access.workshop.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }
  // Voice notes are tied to a workshop slide. ElevenLabs transcribes them where
  // configured; the browser's live transcript is the fallback.
  const slideId = typeof body?.slideId === 'string' && SLIDE_IDS.has(body.slideId) ? body.slideId : null;
  const seconds = Number(body?.seconds);
  let transcript: string | null = slideId && typeof body?.transcript === 'string' ? body.transcript.slice(0, 20000) : null;
  if (slideId) {
    const bytes = await portalStore().readBlob(path);
    if (bytes) transcript = (await transcribe(bytes, String(body?.type ?? 'audio/webm'), String(body?.name ?? 'voice.webm'))) ?? transcript;
  }
  const file = await portalStore().addFile({
    workshopId: access.workshop.id,
    name: String(body?.name ?? 'file').slice(0, 200),
    size: Number(body?.size ?? 0),
    type: String(body?.type ?? '').slice(0, 120),
    path,
    uploadedBy: access.by,
    slideId,
    transcript,
    seconds: slideId && Number.isFinite(seconds) ? Math.round(seconds) : null,
  });
  if (slideId && access.by === 'client') await markStarted(access.workshop);
  syncLater(access.workshop.id);
  return NextResponse.json(file);
}
