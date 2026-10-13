import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { answersLocked, markStarted, partsFor, selfServeWorkshop, valueKeys } from '@/lib/portal/selfserve';
import { portalStore } from '@/lib/portal/store';
import type { SlideAnswer } from '@/lib/portal/types';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 8000;

/** Autosave one slide's self-serve answer. Client only, with their link token. */
export async function POST(req: Request) {
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token') });
  if (!access || access.by !== 'client') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const w = access.workshop;
  if (w.tier !== 'self_serve') return NextResponse.json({ error: 'This is a guided workshop.' }, { status: 400 });
  if (answersLocked(w)) return NextResponse.json({ error: 'This workshop has been submitted, so answers can no longer change.' }, { status: 409 });

  const body = await req.json().catch(() => null);
  const slide = selfServeWorkshop(w).slides.find((s) => s.id === body?.slideId);
  if (!slide) return NextResponse.json({ error: 'unknown slide' }, { status: 400 });

  // Only accept fields this slide actually asks for
  const patch: SlideAnswer = {};
  if (typeof body.text === 'string') patch.text = body.text.slice(0, MAX_TEXT);
  if (body.parts && typeof body.parts === 'object') {
    const allowed = new Set(partsFor(slide).map((p) => p.key));
    patch.parts = Object.fromEntries(
      Object.entries(body.parts as Record<string, unknown>)
        .filter(([k, v]) => allowed.has(k) && typeof v === 'string')
        .map(([k, v]) => [k, (v as string).slice(0, MAX_TEXT)]),
    );
  }
  if (body.values && typeof body.values === 'object') {
    const allowed = new Set(valueKeys(slide));
    patch.values = Object.fromEntries(
      Object.entries(body.values as Record<string, unknown>)
        .filter(([k, v]) => allowed.has(k) && (v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10)))
        .map(([k, v]) => [k, v as number | null]),
    );
  }

  const answers = await portalStore().mergeAnswer(w.id, slide.id, patch);
  await markStarted(w);
  return NextResponse.json({ ok: true, answer: answers[slide.id] });
}
