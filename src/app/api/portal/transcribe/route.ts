import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { chatTurnsUsed, LIMITS } from '@/lib/portal/guide';
import { transcribe } from '@/lib/portal/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // about five minutes of compressed speech

/** Speech-to-text for a spoken reply to the AI facilitator. Client only; the audio isn't stored. */
export async function POST(req: Request) {
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token') });
  if (!access || access.by !== 'client' || access.workshop.tier !== 'self_serve') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // Spoken replies count towards the same per-workshop limit as the AI chat
  if (chatTurnsUsed(access.workshop) >= LIMITS.turnsPerWorkshop) {
    return NextResponse.json({ error: 'You have reached the limit for AI conversations on this workshop.' }, { status: 429 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.byteLength) return NextResponse.json({ error: 'no audio' }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: 'That recording is too long. Keep replies under five minutes.' }, { status: 413 });
  const text = await transcribe(bytes, req.headers.get('content-type') ?? 'audio/webm');
  if (!text) return NextResponse.json({ error: 'We could not make out the recording. Please try again, or type your reply.' }, { status: 422 });
  return NextResponse.json({ text });
}
