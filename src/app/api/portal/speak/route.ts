import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { liveSpeech, voiceConfigured } from '@/lib/portal/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The AI facilitator's reply, spoken. Only speaks text the facilitator actually
 * said in this workshop (looked up from the saved conversation), so it can't
 * be used to voice arbitrary text. ?slideId=S01&i=<turn index>&t=<client link token>
 */
export async function GET(req: Request) {
  if (!voiceConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 404 });
  const url = new URL(req.url);
  const access = await resolveAccess({ token: url.searchParams.get('t') });
  if (!access || access.by !== 'client' || access.workshop.tier !== 'self_serve') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const chat = access.workshop.answers[url.searchParams.get('slideId') ?? '']?.chat ?? [];
  const turn = chat[Number(url.searchParams.get('i'))];
  if (!turn || turn.role !== 'assistant') return NextResponse.json({ error: 'nothing to say' }, { status: 404 });
  try {
    return new Response(await liveSpeech(turn.content), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('facilitator speech failed', err);
    return NextResponse.json({ error: 'audio unavailable' }, { status: 502 });
  }
}
