import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isTeamEmail, setTeamSession, teamDomain } from '@/lib/portal/team';

export const dynamic = 'force-dynamic';

/** Swap a Supabase access token (from the magic link) for a team session cookie */
export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Email sign-in is not configured.' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const token = String(body?.accessToken ?? '');
  if (!token) return NextResponse.json({ error: 'Missing token.' }, { status: 400 });

  const supa = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supa.auth.getUser(token);
  const email = data.user?.email ?? '';
  if (error || !email) return NextResponse.json({ error: 'That sign-in link has expired. Request a new one.' }, { status: 401 });
  if (!isTeamEmail(email)) return NextResponse.json({ error: `Only @${teamDomain()} accounts can sign in.` }, { status: 403 });

  await setTeamSession(email);
  return NextResponse.json({ ok: true });
}
