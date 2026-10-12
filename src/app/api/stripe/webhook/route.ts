import { NextResponse } from 'next/server';
import { fulfil, stripe } from '@/lib/portal/payments';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook: creates the workshop when a Checkout session is paid, even if
 * the client closes the tab before reaching the success page.
 * Events to send: checkout.session.completed, checkout.session.async_payment_succeeded
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'not configured' }, { status: 400 });
  }
  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    try {
      await fulfil(event.data.object.id);
    } catch (err) {
      console.error('webhook fulfil failed', err);
      return NextResponse.json({ error: 'fulfil failed' }, { status: 500 }); // Stripe retries
    }
  }
  return NextResponse.json({ received: true });
}
