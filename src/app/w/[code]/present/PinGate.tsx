'use client';

import { useActionState } from 'react';
import { unlock } from './actions';

export function PinGate({ code, clientName }: { code: string; clientName: string }) {
  const [state, action, pending] = useActionState(unlock.bind(null, code), undefined);
  return (
    <main className="gate">
      <form className="gate-card" action={action}>
        <h1>{clientName}</h1>
        <p>Facilitator view. Enter the Visions PIN to see the notes.</p>
        <label htmlFor="pin">PIN</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus required />
        {state?.error && <p className="error">{state.error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
          {pending ? 'Checking…' : 'Open facilitator view'}
        </button>
      </form>
    </main>
  );
}
