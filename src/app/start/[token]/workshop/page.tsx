import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SelfServe } from '@/components/portal/SelfServe';
import { guideAvailable } from '@/lib/portal/guide';
import { selfServeWorkshop } from '@/lib/portal/selfserve';
import { portalStore } from '@/lib/portal/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your workshop · Visions Design', robots: { index: false, follow: false } };

export default async function SelfServePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = portalStore();
  const w = await store.getByToken(token);
  if (!w) notFound();
  if (w.tier !== 'self_serve' || !w.intakeDone) redirect(`/start/${token}`);

  const notes = (await store.listFiles(w.id)).filter((f) => f.slideId);

  async function submit() {
    'use server';
    const s = portalStore();
    const current = await s.getByToken(token);
    if (!current || current.status === 'complete') return;
    await s.updateWorkshop(current.id, { status: 'submitted', submittedAt: new Date().toISOString() });
    revalidatePath(`/start/${token}`);
  }

  return (
    <SelfServe
      token={token}
      workshopId={w.id}
      workshop={selfServeWorkshop(w)}
      initialAnswers={w.answers}
      initialNotes={notes}
      submitted={Boolean(w.submittedAt)}
      closed={w.status === 'complete'}
      aiEnabled={guideAvailable()}
      submit={submit}
    />
  );
}
