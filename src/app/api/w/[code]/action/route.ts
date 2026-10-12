import { NextResponse } from 'next/server';
import { isFacilitator } from '@/lib/auth';
import { getWorkshopByCode } from '@/lib/content';
import { getStore } from '@/lib/store';
import type { SessionAction } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Clients may only tap the interactive slides (scales and multiple choice).
// Everything else (moving slides, skipping, word lists, markers) is facilitator-only.
const CLIENT_KEYS = /^(S20\.scale\.\d|S21\.q\d)$/;
const ANSWER_KEY = /^[A-Z]\d{2}\.[a-z0-9.]{1,40}$/;

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let action: SessionAction;
  try {
    action = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const facilitator = await isFacilitator(w.slug);
  const slideIds = new Set(w.slides.map((s) => s.id));

  switch (action?.type) {
    case 'answer': {
      if (typeof action.key !== 'string' || !ANSWER_KEY.test(action.key)) {
        return NextResponse.json({ error: 'bad key' }, { status: 400 });
      }
      if (!facilitator && !CLIENT_KEYS.test(action.key)) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (JSON.stringify(action.value ?? null).length > 4000) {
        return NextResponse.json({ error: 'too large' }, { status: 413 });
      }
      break;
    }
    case 'slide':
    case 'override':
    case 'marker':
      if (!facilitator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      if (!slideIds.has(action.slideId)) return NextResponse.json({ error: 'unknown slide' }, { status: 400 });
      if (action.type === 'override' && action.status !== null && !['include', 'light', 'skip'].includes(action.status)) {
        return NextResponse.json({ error: 'bad status' }, { status: 400 });
      }
      if (action.type === 'marker' && action.note && String(action.note).length > 280) {
        return NextResponse.json({ error: 'note too long' }, { status: 413 });
      }
      break;
    case 'recording':
    case 'reset':
      if (!facilitator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      break;
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const state = await getStore().apply(w.slug, action);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
