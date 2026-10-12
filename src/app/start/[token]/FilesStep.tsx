'use client';

import { useState, useTransition } from 'react';
import { Uploader } from '@/components/portal/Uploader';
import type { WorkshopFile } from '@/lib/portal/types';
import { setFilesStep } from './actions';

interface Props {
  token: string;
  workshopId: string;
  files: WorkshopFile[];
  /** 'done' or 'skipped' once they've moved on */
  status?: 'done' | 'skipped';
  /** Step 1 finished, so moving on makes sense */
  canContinue: boolean;
}

/** Step 2 on the client page: optional uploads, with Skip / Continue so it never blocks booking */
export function FilesStep({ token, workshopId, files, status, canContinue }: Props) {
  const [open, setOpen] = useState(!status);
  const [pending, start] = useTransition();

  const finish = (value: 'done' | 'skipped') =>
    start(async () => {
      await setFilesStep(token, value);
      setOpen(false);
    });

  if (!open && status) {
    return (
      <div className="pt-files-done">
        <p>
          {files.length
            ? `${files.length} file${files.length === 1 ? '' : 's'} shared with our team.`
            : 'Skipped. No problem, you can still share files with us at any time.'}
        </p>
        <button type="button" className="pt-link" onClick={() => setOpen(true)}>
          {files.length ? 'Add or remove files' : 'Add files'}
        </button>
      </div>
    );
  }

  return (
    <>
      <Uploader workshopId={workshopId} token={token} files={files} />
      {canContinue && (
        <div className="pt-actions pt-step-actions">
          {files.length ? (
            <button type="button" className="pt-btn" disabled={pending} onClick={() => finish('done')}>
              {pending ? 'Saving…' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="pt-btn pt-btn-ghost" disabled={pending} onClick={() => finish('skipped')}>
              {pending ? 'Saving…' : 'Skip this step'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
