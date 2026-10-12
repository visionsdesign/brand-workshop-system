import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Team sign-in. The session is our own signed cookie holding the person's email.
// With Supabase configured it is issued after a Supabase magic-link sign-in;
// without it, after the facilitator PIN (local use only).

const COOKIE = 'vis_team';
const DAYS = 14;
const secret = () => process.env.SESSION_SECRET || 'dev-only-secret-change-me';

export const teamDomain = () => (process.env.TEAM_EMAIL_DOMAIN || 'visionsdesign.co.uk').toLowerCase();
export const isTeamEmail = (email: string) => email.trim().toLowerCase().endsWith('@' + teamDomain());

function sign(value: string) {
  return createHmac('sha256', secret()).update(`team:${value}`).digest('base64url');
}

export async function setTeamSession(email: string) {
  const exp = Date.now() + DAYS * 864e5;
  const value = `${email.toLowerCase()}|${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${Buffer.from(value).toString('base64url')}.${sign(value)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DAYS * 86400,
  });
}

export async function clearTeamSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in team member's email, or null */
export async function teamMember(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [b64, sig] = raw.split('.');
  if (!b64 || !sig) return null;
  const value = Buffer.from(b64, 'base64url').toString();
  const expected = sign(value);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [email, exp] = value.split('|');
  if (!email || Date.now() > Number(exp) || !isTeamEmail(email)) return null;
  return email;
}

/** For team pages: redirect to sign-in when not signed in */
export async function requireTeam(): Promise<string> {
  const email = await teamMember();
  if (!email) redirect('/team/login');
  return email;
}
