'use client';

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionAction, SessionState } from './types';

// Live sync between the facilitator and the client.
// Writes go through /api/w/[code]/action (validated, persisted server-side).
// The writer then broadcasts the new state on a Supabase Realtime channel so
// everyone else updates instantly. Without Supabase configured, or if a
// broadcast is missed, polling keeps everyone in step.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const realtime = Boolean(SUPA_URL && SUPA_ANON);
const POLL_MS = realtime ? 15000 : 1500;

let supa: ReturnType<typeof createClient> | null = null;
const getSupa = () => (supa ??= createClient(SUPA_URL!, SUPA_ANON!, { auth: { persistSession: false } }));

export type Connection = 'connecting' | 'live' | 'polling' | 'offline';

export function useSession(code: string, initial: SessionState) {
  const [state, setState] = useState(initial);
  const [connection, setConnection] = useState<Connection>(realtime ? 'connecting' : 'polling');
  const channel = useRef<RealtimeChannel | null>(null);
  const revRef = useRef(initial.rev);

  const accept = useCallback((next: SessionState) => {
    if (next.rev >= revRef.current) {
      revRef.current = next.rev;
      setState(next);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/w/${code}/state`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      accept(await r.json());
      setConnection((c) => (c === 'offline' ? (realtime ? 'live' : 'polling') : c));
    } catch {
      setConnection('offline');
    }
  }, [code, accept]);

  useEffect(() => {
    if (!realtime) return;
    const ch = getSupa().channel(`workshop:${code}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'state' }, ({ payload }) => accept(payload as SessionState));
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnection('live');
        refresh();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnection('polling');
      }
    });
    channel.current = ch;
    return () => {
      channel.current = null;
      getSupa().removeChannel(ch);
    };
  }, [code, accept, refresh]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const act = useCallback(
    async (action: SessionAction) => {
      // Optimistic update for the common, low-risk actions
      if (action.type === 'slide') setState((s) => ({ ...s, current: action.slideId }));
      if (action.type === 'answer') setState((s) => ({ ...s, answers: { ...s.answers, [action.key]: action.value } }));
      const r = await fetch(`/api/w/${code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (!r.ok) {
        refresh();
        return;
      }
      const next: SessionState = await r.json();
      accept(next);
      channel.current?.send({ type: 'broadcast', event: 'state', payload: next });
    },
    [code, accept, refresh],
  );

  return { state, act, connection, refresh };
}
