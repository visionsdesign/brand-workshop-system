'use client';

import { useActionState } from 'react';
import type { Tier } from '@/lib/portal/types';
import { startCheckout } from './actions';

export function BuyForm({ tier, price }: { tier: Tier; price: string }) {
  const [state, action, pending] = useActionState(startCheckout.bind(null, tier), undefined);
  const v = state?.values ?? {};
  return (
    <form className="pt-form" action={action}>
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
      <button className="pt-btn" disabled={pending}>{pending ? 'Opening secure checkout…' : `Pay ${price}`}</button>
      <p className="pt-hint">Secure payment by Stripe. You&apos;ll get a VAT invoice by email.</p>
    </form>
  );
}
