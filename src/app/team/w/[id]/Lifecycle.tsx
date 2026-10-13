'use client';

import { useState, useTransition } from 'react';
import type { WorkshopStatus } from '@/lib/portal/types';
import { setLifecycle, type FormState, type LifecycleAction } from '../../actions';

interface Props {
  id: string;
  status: WorkshopStatus;
  archived: boolean;
}

const CONFIRM: Partial<Record<LifecycleAction, string>> = {
  complete: 'Mark this workshop complete? The client will see a "Workshop complete" page and can no longer change their answers.',
  reopen: 'Reopen this workshop? The client will be able to change their answers again.',
  archive: 'Archive this workshop? It moves to the Archived list. Nothing is deleted.',
};

/** Complete, reopen, archive and unarchive buttons for one workshop */
export function Lifecycle({ id, status, archived }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState>();

  const run = (action: LifecycleAction) => {
    if (CONFIRM[action] && !window.confirm(CONFIRM[action])) return;
    start(async () => setResult(await setLifecycle(id, action)));
  };

  const done = status === 'complete';
  return (
    <div className="tm-lifecycle">
      {done ? (
        <button type="button" className="btn" disabled={pending} onClick={() => run('reopen')}>Reopen for the client</button>
      ) : (
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run('complete')}>Mark workshop complete</button>
      )}
      {archived ? (
        <button type="button" className="btn" disabled={pending} onClick={() => run('unarchive')}>Unarchive</button>
      ) : (
        <button type="button" className="btn" disabled={pending} onClick={() => run('archive')}>Archive workshop</button>
      )}
      {result?.ok && <span className="tm-ok">{result.ok}</span>}
      {result?.error && <span className="pt-error">{result.error}</span>}
    </div>
  );
}
