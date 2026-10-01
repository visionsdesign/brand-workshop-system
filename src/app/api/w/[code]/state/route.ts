import { NextResponse } from 'next/server';
import { getWorkshopByCode } from '@/lib/content';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const state = await getStore().get(w.slug);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
