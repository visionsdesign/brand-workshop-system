'use client';

import { useActionState } from 'react';
import { INTAKE_FIELDS } from '@/lib/portal/intake';
import type { Intake } from '@/lib/portal/types';
import { saveIntake } from './actions';

export function IntakeForm({ token, intake, done }: { token: string; intake: Intake; done: boolean }) {
  const [state, action, pending] = useActionState(saveIntake.bind(null, token), undefined);
  const values = state?.values ?? intake;
  return (
    <form className="pt-form pt-intake" action={action}>
      {INTAKE_FIELDS.map((f) => (
        <label key={f.key}>
          <span>
            {f.label}
            {f.required && <em> (required)</em>}
          </span>
          {f.hint && <small>{f.hint}</small>}
          {f.long ? (
            <textarea name={f.key} defaultValue={values[f.key] ?? ''} rows={3} />
          ) : (
            <input name={f.key} defaultValue={values[f.key] ?? ''} />
          )}
        </label>
      ))}
      {state?.error && <p className="pt-error" role="alert">{state.error}</p>}
      {state?.saved && !state.error && <p className="pt-ok" role="status">Saved.</p>}
      <div className="pt-actions">
        <button className="pt-btn pt-btn-ghost" name="intent" value="draft" disabled={pending}>Save for later</button>
        <button className="pt-btn" name="intent" value="finish" disabled={pending}>
          {done ? 'Save changes' : 'Save and continue'}
        </button>
      </div>
    </form>
  );
}
