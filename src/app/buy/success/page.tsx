import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fulfil } from '@/lib/portal/payments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment received · Visions Design', robots: { index: false, follow: false } };

/** Stripe sends the client here after paying. Set up their workshop (if the webhook hasn't already) and take them to it. */
export default async function BuySuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let token: string | null = null;
  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      token = (await fulfil(session_id))?.token ?? null;
    } catch (err) {
      console.error('fulfil on success page failed', err);
    }
  }
  if (token) redirect(`/start/${token}?welcome=1&paid=1`);

  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Thank you</h1>
        <p>
          We couldn&apos;t confirm your payment just yet. If you were charged, your workshop is being set up and we&apos;ll
          email you the link shortly. If it doesn&apos;t arrive, contact us and we&apos;ll sort it straight away.
        </p>
        <Link className="btn" href="/">Back to the workshop page</Link>
      </div>
    </main>
  );
}
