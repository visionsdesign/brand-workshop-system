import { NextResponse } from 'next/server';
import { isFacilitator } from '@/lib/auth';
import { getWorkshopByCode } from '@/lib/content';
import { getStore } from '@/lib/store';
import { timelineMarkdown } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

/**
 * Facilitator-only export for `Capture:`. Lists every slide change and marker
 * as a timestamp relative to the recording start, plus the tapped answers, so
 * the call transcript can be lined up slide by slide.
 *   ?format=json for the raw events
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!(await isFacilitator(w.slug))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const store = getStore();
  const [state, events] = await Promise.all([store.get(w.slug), store.timeline(w.slug)]);

  if (new URL(req.url).searchParams.get('format') === 'json') {
    return NextResponse.json({ state, events });
  }
  return new NextResponse(timelineMarkdown(w, state, events), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${w.slug}-workshop-timeline.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
