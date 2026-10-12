import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/**
 * Cal.com webhook. Matches the booking to a workshop through the workshopId
 * metadata the embed attaches, and records the confirmed time.
 * Triggers to send: Booking created, Booking rescheduled, Booking cancelled.
 */
export async function POST(req: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 400 });
  const body = await req.text();
  const sig = req.headers.get('x-cal-signature-256') ?? '';
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const event = JSON.parse(body) as { triggerEvent?: string; payload?: Record<string, any> };
  const p = event.payload ?? {};
  const workshopId = String(p.metadata?.workshopId ?? '');
  if (!UUID.test(workshopId)) return NextResponse.json({ ignored: 'no workshop id' });

  const store = portalStore();
  const w = await store.getById(workshopId);
  if (!w || w.tier !== 'guided') return NextResponse.json({ ignored: 'unknown workshop' });

  switch (event.triggerEvent) {
    case 'BOOKING_CREATED':
    case 'BOOKING_RESCHEDULED':
      await store.updateWorkshop(w.id, {
        booking: { uid: p.uid ?? null, start: iso(p.startTime), end: iso(p.endTime), status: 'confirmed' },
        status: w.status === 'intake' || w.status === 'ready' ? 'booked' : w.status,
      });
      break;
    case 'BOOKING_CANCELLED':
      // Only clear it if it's the booking we hold (a reschedule cancels the old one)
      if (!w.booking?.uid || w.booking.uid === p.uid) {
        await store.updateWorkshop(w.id, {
          booking: { uid: p.uid ?? null, start: iso(p.startTime), end: iso(p.endTime), status: 'cancelled' },
          status: w.status === 'booked' ? 'ready' : w.status,
        });
      }
      break;
  }
  return NextResponse.json({ ok: true });
}
