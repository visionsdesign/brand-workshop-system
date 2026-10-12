'use client';

import { createClient } from '@supabase/supabase-js';
import { useActionState, useState } from 'react';
import { pinLogin } from '../actions';

interface Props {
  mode: 'email' | 'pin';
  domain: string;
  supabaseUrl: string;
  anonKey: string;
}

export function LoginForms(p: Props) {
  return p.mode === 'email' ? <EmailLogin {...p} /> : <PinLogin domain={p.domain} />;
}

/** Supabase magic link. The link lands on /team/auth, which swaps it for our team session. */
function EmailLogin({ domain, supabaseUrl, anonKey }: Props) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim().toLowerCase().endsWith('@' + domain)) {
      setError(`Use your @${domain} email.`);
      return;
    }
    setState('sending');
    const supa = createClient(supabaseUrl, anonKey, { auth: { flowType: 'implicit' } });
    const { error } = await supa.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/team/auth` },
    });
    if (error) {
      setState('error');
      setError(error.message);
    } else setState('sent');
  }

  if (state === 'sent') return <p>Check {email} for a sign-in link. You can close this tab.</p>;
  return (
    <form onSubmit={send}>
      <label htmlFor="email">Work email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${domain}`} required autoFocus />
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}

/** Local only: email plus the facilitator PIN from .env.local */
function PinLogin({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState(pinLogin, undefined);
  return (
    <form action={action}>
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" placeholder={`you@${domain}`} required autoFocus />
      <label htmlFor="pin" style={{ marginTop: 14 }}>PIN</label>
      <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" required />
      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? 'Checking…' : 'Sign in'}</button>
      <p style={{ marginTop: 14, fontSize: 12 }}>Running locally without Supabase, so sign-in uses the facilitator PIN.</p>
    </form>
  );
}
