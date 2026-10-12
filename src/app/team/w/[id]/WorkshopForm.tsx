'use client';

import { useActionState } from 'react';
import { STATUS_LABEL, type WorkshopStatus } from '@/lib/portal/types';
import { updateWorkshop } from '../../actions';

interface Props {
  id: string;
  status: WorkshopStatus;
  driveFolderUrl: string;
  teamNotes: string;
}

export function WorkshopForm({ id, status, driveFolderUrl, teamNotes }: Props) {
  const [state, action, pending] = useActionState(updateWorkshop.bind(null, id), undefined);
  const v = state?.values;
  return (
    <form className="tm-form" action={action}>
      <label>
        Status
        <select name="status" defaultValue={v?.status ?? status} key={v?.status ?? status}>
          {(Object.keys(STATUS_LABEL) as WorkshopStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>
      <label>
        Google Drive folder
        <input name="driveFolderUrl" type="url" defaultValue={v?.driveFolderUrl ?? driveFolderUrl} placeholder="https://drive.google.com/drive/folders/…" />
      </label>
      <label>
        Team notes (never shown to the client)
        <textarea name="teamNotes" rows={5} defaultValue={v?.teamNotes ?? teamNotes} />
      </label>
      <div className="tm-row">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        {state?.ok && <span className="tm-ok">{state.ok}</span>}
        {state?.error && <span className="pt-error">{state.error}</span>}
      </div>
    </form>
  );
}
