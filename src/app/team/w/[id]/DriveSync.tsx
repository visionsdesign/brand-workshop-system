'use client';

import { useState, useTransition } from 'react';
import { syncToDrive } from '../../actions';

/** "Sync to Drive now": copies anything new to the workshop's Shared Drive folder and rewrites its documents */
export function DriveSync({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string; url?: string }>();
  return (
    <div className="tm-lifecycle">
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => setResult(await syncToDrive(id)))}>
        {pending ? 'Syncing…' : 'Sync to Drive now'}
      </button>
      {result?.ok && (
        <span className="tm-ok">
          {result.ok}
          {result.url && <> · <a href={result.url} target="_blank" rel="noreferrer">open folder ↗</a></>}
        </span>
      )}
      {result?.error && <span className="pt-error">{result.error}</span>}
    </div>
  );
}
