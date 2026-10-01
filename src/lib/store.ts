// Session persistence. Uses Supabase (service role, server-side only) when
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise an in-memory store
// that is fine for local dev but resets on restart and doesn't work across
// serverless instances.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SessionAction, SessionState, SlideStatus, TimelineEvent } from './types';

interface Store {
  get(slug: string): Promise<SessionState>;
  apply(slug: string, action: SessionAction): Promise<SessionState>;
  timeline(slug: string): Promise<TimelineEvent[]>;
}

const empty = (): SessionState => ({ current: null, overrides: {}, answers: {}, recordingStartedAt: null, rev: 0 });

// ---------- memory ----------

interface MemSession { state: SessionState; events: TimelineEvent[] }
const g = globalThis as unknown as { __workshopStore?: Map<string, MemSession> };
const mem = (g.__workshopStore ??= new Map());

const memoryStore: Store = {
  async get(slug) {
    return mem.get(slug)?.state ?? empty();
  },
  async apply(slug, action) {
    const s = mem.get(slug) ?? { state: empty(), events: [] };
    const now = new Date().toISOString();
    const st = { ...s.state };
    switch (action.type) {
      case 'slide':
        if (st.current !== action.slideId) s.events.push({ kind: 'slide', slideId: action.slideId, at: now });
        st.current = action.slideId;
        break;
      case 'answer':
        st.answers = { ...st.answers };
        if (action.value === null) delete st.answers[action.key];
        else st.answers[action.key] = action.value;
        break;
      case 'override':
        st.overrides = { ...st.overrides };
        if (action.status) st.overrides[action.slideId] = action.status;
        else delete st.overrides[action.slideId];
        break;
      case 'recording':
        st.recordingStartedAt = action.start ? now : null;
        s.events.push({ kind: 'recording', slideId: st.current, note: action.start ? 'start' : 'stop', at: now });
        break;
      case 'marker':
        s.events.push({ kind: 'marker', slideId: action.slideId, note: action.note ?? null, at: now });
        break;
    }
    st.rev = Date.now();
    s.state = st;
    mem.set(slug, s);
    return st;
  },
  async timeline(slug) {
    return mem.get(slug)?.events ?? [];
  },
};

// ---------- supabase ----------

function supabaseStore(db: SupabaseClient): Store {
  async function read(slug: string): Promise<SessionState> {
    const [{ data: row, error: e1 }, { data: answers, error: e2 }] = await Promise.all([
      db.from('workshop_sessions').select('*').eq('slug', slug).maybeSingle(),
      db.from('workshop_answers').select('key, value, updated_at').eq('slug', slug),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const latestAnswer = Math.max(0, ...(answers ?? []).map((a) => Date.parse(a.updated_at)));
    return {
      current: row?.current_slide ?? null,
      overrides: (row?.overrides as Record<string, SlideStatus>) ?? {},
      answers: Object.fromEntries((answers ?? []).map((a) => [a.key, a.value])),
      recordingStartedAt: row?.recording_started_at ?? null,
      rev: Math.max(row ? Date.parse(row.updated_at) : 0, latestAnswer),
    };
  }

  async function upsertSession(slug: string, patch: Record<string, unknown>) {
    const { error } = await db
      .from('workshop_sessions')
      .upsert({ slug, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'slug' });
    if (error) throw error;
  }

  async function event(slug: string, e: Omit<TimelineEvent, 'at'>) {
    const { error } = await db.from('workshop_events').insert({ slug, kind: e.kind, slide_id: e.slideId, note: e.note ?? null });
    if (error) throw error;
  }

  return {
    get: read,
    async apply(slug, action) {
      switch (action.type) {
        case 'slide': {
          const cur = await read(slug);
          if (cur.current !== action.slideId) await event(slug, { kind: 'slide', slideId: action.slideId });
          await upsertSession(slug, { current_slide: action.slideId });
          break;
        }
        case 'answer': {
          const { error } = action.value === null
            ? await db.from('workshop_answers').delete().eq('slug', slug).eq('key', action.key)
            : await db.from('workshop_answers').upsert(
                { slug, key: action.key, value: action.value, updated_at: new Date().toISOString() },
                { onConflict: 'slug,key' },
              );
          if (error) throw error;
          break;
        }
        case 'override': {
          const cur = await read(slug);
          const overrides = { ...cur.overrides };
          if (action.status) overrides[action.slideId] = action.status;
          else delete overrides[action.slideId];
          await upsertSession(slug, { overrides });
          break;
        }
        case 'recording': {
          const cur = await read(slug);
          await upsertSession(slug, { recording_started_at: action.start ? new Date().toISOString() : null });
          await event(slug, { kind: 'recording', slideId: cur.current, note: action.start ? 'start' : 'stop' });
          break;
        }
        case 'marker':
          await event(slug, { kind: 'marker', slideId: action.slideId, note: action.note });
          break;
      }
      return read(slug);
    },
    async timeline(slug) {
      const { data, error } = await db
        .from('workshop_events')
        .select('kind, slide_id, note, at')
        .eq('slug', slug)
        .order('at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ kind: r.kind, slideId: r.slide_id, note: r.note, at: r.at }));
    },
  };
}

let store: Store | null = null;
export function getStore(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = supabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('workshop: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set, using in-memory store');
    }
    store = memoryStore;
  }
  return store;
}
