import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import { selfServeWorkshop, spokenQuestion } from '@/lib/portal/selfserve';
import { questionAudio, voiceConfigured } from '@/lib/portal/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** A self-serve question read aloud (MP3). ?slideId=S01&t=<client link token> */
export async function GET(req: Request) {
  if (!voiceConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 404 });
  const url = new URL(req.url);
  const access = await resolveAccess({ token: url.searchParams.get('t') });
  if (!access || access.workshop.tier !== 'self_serve') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const slide = selfServeWorkshop(access.workshop).slides.find((s) => s.id === url.searchParams.get('slideId'));
  if (!slide) return NextResponse.json({ error: 'unknown slide' }, { status: 400 });
  try {
    const audio = await questionAudio(spokenQuestion(slide));
    return new NextResponse(Buffer.from(audio), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' },
    });
  } catch (err) {
    console.error('question audio failed', err);
    return NextResponse.json({ error: 'audio unavailable' }, { status: 502 });
  }
}
