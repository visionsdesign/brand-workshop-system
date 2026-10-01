'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkPin, cookieName, facilitatorToken } from '@/lib/auth';
import { getWorkshopByCode } from '@/lib/content';

export async function unlock(code: string, _prev: { error?: string } | undefined, form: FormData) {
  const w = getWorkshopByCode(code);
  if (!w) return { error: 'Workshop not found.' };
  if (!checkPin(String(form.get('pin') ?? ''))) return { error: 'That PIN is not right.' };
  const jar = await cookies();
  jar.set(cookieName(w.slug), facilitatorToken(w.slug), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  redirect(`/w/${code}/present`);
}
