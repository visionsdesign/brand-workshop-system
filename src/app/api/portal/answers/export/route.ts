import { NextResponse } from 'next/server';
import { answersMarkdown } from '@/lib/portal/selfserve';
import { portalStore } from '@/lib/portal/store';
import { teamMember } from '@/lib/portal/team';

export const dynamic = 'force-dynamic';

/** Team only: a self-serve workshop's answers as markdown, for Capture and the playbook */
export async function GET(req: Request) {
  if (!(await teamMember())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const store = portalStore();
  const w = await store.getById(url.searchParams.get('workshopId') ?? '');
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
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
