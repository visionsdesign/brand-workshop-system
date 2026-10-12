'use client';

import { useEffect, useState } from 'react';

/** Landing page for the Supabase magic link: hands the access token to the server, which sets the team session. */
export default function TeamAuth() {
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const err = hash.get('error_description') ?? new URLSearchParams(window.location.search).get('error_description');
    if (!accessToken) {
      setMessage(err ?? 'That sign-in link is missing its token. Request a new one.');
      return;
    }
    // Remove the token from the address bar straight away
    history.replaceState(null, '', '/team/auth');
    fetch('/api/team/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    }).then(async (r) => {
      if (r.ok) window.location.replace('/team');
      else setMessage((await r.json().catch(() => null))?.error ?? 'Sign-in failed. Request a new link.');
    });
  }, []);

  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Visions team</h1>
        <p>{message}</p>
        <a className="btn" href="/team/login">Back to sign in</a>
      </div>
    </main>
  );
}
