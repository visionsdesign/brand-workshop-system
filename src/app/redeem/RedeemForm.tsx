'use client';

import { useActionState } from 'react';
import { redeem } from './actions';

export function RedeemForm() {
  const [state, action, pending] = useActionState(redeem, undefined);
  const v = state?.values ?? {};
  return (
    <form className="pt-form" action={action}>
      <label>
        Workshop code
        <input name="code" defaultValue={v.code} placeholder="VIS-XXXX-XXXX" autoComplete="off" required className="pt-code" />
      </label>
      <label>
        Company or brand name
        <input name="clientName" defaultValue={v.clientName} autoComplete="organization" required />
      </label>
      <div className="pt-form-row">
        <label>
          Your name
          <input name="contactName" defaultValue={v.contactName} autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="contactEmail" type="email" defaultValue={v.contactEmail} autoComplete="email" required />
        </label>
      </div>
      {state?.error && <p className="pt-error" role="alert">{state.error}</p>}
      <button className="pt-btn" disabled={pending}>{pending ? 'Setting up…' : 'Start my workshop'}</button>
    </form>
  );
}
