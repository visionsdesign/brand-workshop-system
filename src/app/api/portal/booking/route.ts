import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/**
 * The client's browser reports a booking straight after Cal.com confirms it.
 * Recorded as 'pending' until Cal.com's own webhook confirms it (see /api/calcom/webhook).
 */
export async function POST(req: Request) {
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token') });
  if (!access || access.by !== 'client') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const w = access.workshop;
  if (w.tier !== 'guided') return NextResponse.json({ error: 'not a guided workshop' }, { status: 400 });
  // Never downgrade a booking Cal.com has already confirmed
  if (w.booking?.status === 'confirmed') return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  const uid = typeof body?.uid === 'string' ? body.uid.slice(0, 100) : null;
  await portalStore().updateWorkshop(w.id, {
    booking: { uid, start: iso(body?.start), end: iso(body?.end), status: 'pending' },
    status: w.status === 'intake' || w.status === 'ready' ? 'booked' : w.status,
  });
  return NextResponse.json({ ok: true });
}
