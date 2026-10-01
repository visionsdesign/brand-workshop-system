import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// One facilitator PIN for all workshops (FACILITATOR_PIN). The cookie is
// scoped to a workshop slug so unlocking one presenter view doesn't unlock others.

const DEV_PIN = '0000';
const pin = () => process.env.FACILITATOR_PIN || (process.env.NODE_ENV === 'production' ? '' : DEV_PIN);
const secret = () => process.env.SESSION_SECRET || 'dev-only-secret-change-me';

export const cookieName = (slug: string) => `fac_${slug}`;

function sign(slug: string) {
  return createHmac('sha256', secret()).update(`facilitator:${slug}:${pin()}`).digest('hex');
}

export function checkPin(input: string): boolean {
  const p = pin();
  if (!p) return false;
  const a = Buffer.from(input.trim());
  const b = Buffer.from(p);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function facilitatorToken(slug: string) {
  return sign(slug);
}

export async function isFacilitator(slug: string): Promise<boolean> {
  if (!pin()) return false;
  const jar = await cookies();
  const v = jar.get(cookieName(slug))?.value;
  if (!v) return false;
  const expected = sign(slug);
  return v.length === expected.length && timingSafeEqual(Buffer.from(v), Buffer.from(expected));
}
