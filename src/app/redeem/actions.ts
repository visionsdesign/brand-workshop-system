'use server';

import { redirect } from 'next/navigation';
import { portalStore } from '@/lib/portal/store';

export interface RedeemState {
  error?: string;
  values?: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function redeem(_prev: RedeemState | undefined, form: FormData): Promise<RedeemState> {
  const values = {
    code: String(form.get('code') ?? '').trim(),
    clientName: String(form.get('clientName') ?? '').trim(),
    contactName: String(form.get('contactName') ?? '').trim(),
    contactEmail: String(form.get('contactEmail') ?? '').trim(),
  };
  if (!values.code || !values.clientName || !values.contactName || !values.contactEmail) {
    return { error: 'Please fill in every field.', values };
  }
  if (!EMAIL.test(values.contactEmail)) return { error: 'That email address does not look right.', values };
  if (values.clientName.length > 120 || values.contactName.length > 120) return { error: 'Please shorten the names.', values };

  const res = await portalStore().redeemCode(values.code, {
    clientName: values.clientName,
    contactName: values.contactName,
    contactEmail: values.contactEmail,
  });
  if ('error' in res) return { error: res.error, values };
  redirect(`/start/${res.workshop.token}?welcome=1`);
}
