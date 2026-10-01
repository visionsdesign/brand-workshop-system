import { notFound } from 'next/navigation';
import { ClientView } from '@/components/ClientView';
import { getWorkshopByCode, publicWorkshop } from '@/lib/content';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  return { title: w ? `${w.clientName} · Brand Workshop` : 'Brand Workshop' };
}

export default async function ClientPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const w = getWorkshopByCode(code);
  if (!w) notFound();
  const state = await getStore().get(w.slug);
  return <ClientView workshop={publicWorkshop(w)} initial={state} />;
}
