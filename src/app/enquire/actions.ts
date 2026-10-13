'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { addEnquiry, type Interest } from '@/lib/portal/enquiries';
import { notifyEnquiry } from '@/lib/portal/notify';
import { hit } from '@/lib/portal/ratelimit';

export interface EnquiryState {
  ok?: boolean;
  error?: string;
  values?: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERESTS: Interest[] = ['guided', 'self_serve', 'not_sure'];

/** "I'd like to talk it through first": save the visitor's details for the team to follow up */
export async function enquire(_prev: EnquiryState | undefined, form: FormData): Promise<EnquiryState> {
  const get = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  const values = {
    name: get('name', 120), email: get('email', 200), phone: get('phone', 40), company: get('company', 160),
    interest: get('interest', 20), message: get('message', 2000), contactBy: get('contactBy', 10),
  };
  // Bots fill in the hidden field; pretend it worked
  if (get('website', 200)) return { ok: true };
  if (!values.name || !values.email) return { error: 'Please add your name and email.', values };
  if (!EMAIL.test(values.email)) return { error: 'That email address does not look right.', values };
  if (values.contactBy === 'phone' && !values.phone) return { error: 'Add a phone number, or choose email.', values };

  // A few per visitor per hour, and a ceiling per day for the whole site
  const h = await headers();
  const ip = h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const visitor = createHash('sha256').update(`${process.env.SESSION_SECRET ?? ''}|${ip}`).digest('hex').slice(0, 24);
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  if ((await hit(`enq:${visitor}:${hour}`)) > 5 || (await hit(`enq:all:${hour.slice(0, 10)}`)) > 200) {
    return { error: 'We have had a lot of messages just now. Please try again a little later.', values };
  }

  const enquiry = {
    name: values.name, email: values.email, phone: values.phone, company: values.company,
    interest: INTERESTS.includes(values.interest as Interest) ? (values.interest as Interest) : 'not_sure' as Interest,
    message: values.message, contactBy: (values.contactBy === 'phone' ? 'phone' : 'email') as 'phone' | 'email',
  };
  try {
    await addEnquiry(enquiry);
    notifyEnquiry(enquiry);
  } catch (err) {
    console.error('saving enquiry failed', err);
    return { error: 'That did not send. Please try again, or use Talk to the team below.', values };
  }
  return { ok: true };
}
