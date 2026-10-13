import { NextResponse } from 'next/server';
import { answersMarkdown } from '@/lib/portal/selfserve';
import { resolveAccess } from '@/lib/portal/access';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';

/**
 * A self-serve workshop's answers as markdown: for the team (Capture and the
 * playbook, by workshopId) or the client's own copy (by their link token, ?t=).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const access = await resolveAccess({ token: url.searchParams.get('t'), workshopId: url.searchParams.get('workshopId') });
  if (!access) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const w = access.workshop;
  const store = portalStore();
  const files = await store.listFiles(w.id);
  const slug = w.clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workshop';
  return new NextResponse(answersMarkdown(w, files, url.origin), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-workshop-answers.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
