// Saved ViVi conversations for the team area. Supabase when configured,
// otherwise .data/vivi.json on this machine.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { portalStore } from './store';
import type { ChatTurn } from './types';

export interface ViviConversation {
  id: string;
  visitor: string;
  page: string;
  workshopId: string | null;
  turns: ChatTurn[];
  messageCount: number;
  startedAt: string;
  updatedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isConversationId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

/**
 * Where the chat happened, in plain words. Client workshop links contain a
 * secret token, so it's swapped for the workshop it belongs to and never saved.
 */
export async function describePage(path: unknown): Promise<{ page: string; workshopId: string | null }> {
  const p = typeof path === 'string' ? path.split('?')[0] : '';
  if (p === '/' || p === '') return { page: 'Landing page', workshopId: null };
  if (p === '/buy/guided') return { page: 'Buy: Guided', workshopId: null };
  if (p === '/buy/self-serve') return { page: 'Buy: Self-serve', workshopId: null };
  const m = p.match(/^\/start\/([A-Za-z0-9_-]+)(\/booked)?$/);
  if (m) {
    const w = await portalStore().getByToken(m[1]);
    return { page: m[2] ? 'Booking summary' : 'Client workshop page', workshopId: w?.id ?? null };
  }
  return { page: 'Other page', workshopId: null };
}

let db: SupabaseClient | null = null;
const supa = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (db ??= createClient(url, key, { auth: { persistSession: false } }));
};

const FILE = join(process.cwd(), '.data', 'vivi.json');
async function loadLocal(): Promise<ViviConversation[]> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    return [];
  }
}

const fromRow = (r: Record<string, any>): ViviConversation => ({
  id: r.id, visitor: r.visitor, page: r.page, workshopId: r.workshop_id ?? null, turns: r.turns ?? [],
  messageCount: r.message_count, startedAt: r.started_at, updatedAt: r.updated_at,
});

/**
 * Save the conversation so far. A conversation can only be extended by the
 * visitor who started it, so nobody can overwrite someone else's.
 */
export async function saveConversation(c: { id: string; visitor: string; page: string; workshopId: string | null; turns: ChatTurn[] }) {
  const now = new Date().toISOString();
  const s = supa();
  if (s) {
    const { data: existing } = await s.from('vivi_conversations').select('visitor').eq('id', c.id).maybeSingle();
    if (existing && existing.visitor !== c.visitor) return;
    const { error } = await s.from('vivi_conversations').upsert({
      id: c.id, visitor: c.visitor, page: c.page, workshop_id: c.workshopId,
      turns: c.turns, message_count: c.turns.length, updated_at: now,
    }, { onConflict: 'id' });
    if (error) console.error('saving ViVi conversation failed', error);
    return;
  }
  const all = await loadLocal();
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0 && all[i].visitor !== c.visitor) return;
  const row: ViviConversation = { ...c, messageCount: c.turns.length, startedAt: i >= 0 ? all[i].startedAt : now, updatedAt: now };
  if (i >= 0) all[i] = row;
  else all.unshift(row);
  await mkdir(join(process.cwd(), '.data'), { recursive: true });
  await writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function listConversations(limit = 200): Promise<ViviConversation[]> {
  const s = supa();
  if (s) {
    const { data, error } = await s.from('vivi_conversations').select('*').order('updated_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }
  return (await loadLocal()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
