'use client';

import { useTransition } from 'react';
import { markEnquiry } from '../actions';

export function HandledButton({ id, handled }: { id: string; handled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`btn ${handled ? '' : 'btn-primary'}`} disabled={pending} onClick={() => start(() => markEnquiry(id, !handled))}>
      {pending ? 'Saving…' : handled ? 'Move back to new' : 'Mark as followed up'}
    </button>
  );
}
