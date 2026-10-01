import { notFound } from 'next/navigation';
import { PresenterView } from '@/components/PresenterView';
import { isFacilitator } from '@/lib/auth';
import { getNotes, getWorkshopByCode } from '@/lib/content';
import { getStore } from '@/lib/store';
import { PinGate } from './PinGate';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  return { title: w ? `Facilitator · ${w.clientName}` : 'Facilitator' };
}

export default async function PresentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  if (!w) notFound();
  if (!(await isFacilitator(w.slug))) return <PinGate code={code} clientName={w.clientName} />;

  const store = getStore();
  const [state, events] = await Promise.all([store.get(w.slug), store.timeline(w.slug)]);
  return <PresenterView workshop={w} notes={getNotes(w.slug)} initial={state} initialEvents={events} />;
}
