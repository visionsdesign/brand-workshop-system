'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { canBuy, createCheckout } from '@/lib/portal/payments';
import type { Tier } from '@/lib/portal/types';

export interface BuyState {
  error?: string;
  values?: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function startCheckout(tier: Tier, _prev: BuyState | undefined, form: FormData): Promise<BuyState> {
  const values = {
    clientName: String(form.get('clientName') ?? '').trim().slice(0, 120),
    contactName: String(form.get('contactName') ?? '').trim().slice(0, 120),
    contactEmail: String(form.get('contactEmail') ?? '').trim().slice(0, 200),
  };
  if (!canBuy(tier)) return { error: 'Online purchase is not open yet. Please contact us.', values };
  if (!values.clientName || !values.contactName || !values.contactEmail) return { error: 'Please fill in every field.', values };
  if (!EMAIL.test(values.contactEmail)) return { error: 'That email address does not look right.', values };

  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  let url: string;
  try {
    url = await createCheckout({ tier, origin, ...values });
  } catch (err) {
    console.error('checkout failed', err);
    return { error: 'We could not start the payment. Please try again in a moment.', values };
  }
  redirect(url);
}
