'use client';

import { useActionState, useState } from 'react';
import { createCode } from '../actions';

export function CodeForm() {
  const [state, action, pending] = useActionState(createCode, undefined);
  const [copied, setCopied] = useState('');
  return (
    <form className="tm-card tm-codeform" action={action}>
      <label>
        Type
        <select name="tier" defaultValue="guided">
          <option value="guided">Guided workshop</option>
          <option value="self_serve">Self-serve workshop</option>
        </select>
      </label>
      <label>
        For (client or invoice)
        <input name="label" placeholder="e.g. Acme Ltd, INV-1042" />
      </label>
      <label>
        Uses
        <input name="maxUses" type="number" min={1} max={50} defaultValue={1} />
      </label>
      <label>
        Expires after (days)
        <input name="days" type="number" min={0} defaultValue={60} />
      </label>
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create code'}</button>
      {state?.ok && (
        <p className="tm-newcode">
          New code <code>{state.ok}</code>
          <button
            type="button"
            className="btn"
            onClick={() => navigator.clipboard.writeText(state.ok!).then(() => setCopied(state.ok!))}
          >
            {copied === state.ok ? 'Copied' : 'Copy'}
          </button>
        </p>
      )}
      {state?.error && <p className="pt-error">{state.error}</p>}
    </form>
  );
}
