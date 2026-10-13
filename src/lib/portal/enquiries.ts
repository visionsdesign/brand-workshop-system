// Enquiries from the landing page: people who want to talk to the team before
// choosing a workshop. Supabase when configured, otherwise .data/enquiries.json.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Interest = 'guided' | 'self_serve' | 'not_sure';
export const INTEREST_LABEL: Record<Interest, string> = {
  guided: 'Guided workshop',
  self_serve: 'Self-serve workshop',
  not_sure: 'Not sure yet',
};

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  interest: Interest;
  message: string;
  contactBy: 'email' | 'phone';
  handledAt: string | null;
  handledBy: string | null;
  createdAt: string;
}

export type NewEnquiry = Omit<Enquiry, 'id' | 'handledAt' | 'handledBy' | 'createdAt'>;

let db: SupabaseClient | null = null;
const supa = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (db ??= createClient(url, key, { auth: { persistSession: false } }));
};

const FILE = join(process.cwd(), '.data', 'enquiries.json');
async function loadLocal(): Promise<Enquiry[]> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    return [];
  }
}
async function saveLocal(all: Enquiry[]) {
  await mkdir(join(process.cwd(), '.data'), { recursive: true });
  await writeFile(FILE, JSON.stringify(all, null, 2));
}

const fromRow = (r: Record<string, any>): Enquiry => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone ?? '', company: r.company ?? '', interest: r.interest,
  message: r.message ?? '', contactBy: r.contact_by, handledAt: r.handled_at ?? null, handledBy: r.handled_by ?? null,
  createdAt: r.created_at,
});

export async function addEnquiry(e: NewEnquiry): Promise<void> {
  const s = supa();
  if (s) {
    const { error } = await s.from('portal_enquiries').insert({
      name: e.name, email: e.email, phone: e.phone || null, company: e.company || null, interest: e.interest,
      message: e.message || null, contact_by: e.contactBy,
    });
    if (error) throw error;
    return;
  }
  const all = await loadLocal();
  all.unshift({ ...e, id: randomUUID(), handledAt: null, handledBy: null, createdAt: new Date().toISOString() });
  await saveLocal(all);
}

export async function listEnquiries(limit = 300): Promise<Enquiry[]> {
  const s = supa();
  if (s) {
    const { data, error } = await s.from('portal_enquiries').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }
  return (await loadLocal()).slice(0, limit);
}

/** Mark an enquiry as followed up (or back to new) */
export async function setHandled(id: string, by: string | null): Promise<void> {
  const patch = by ? { handled_at: new Date().toISOString(), handled_by: by } : { handled_at: null, handled_by: null };
  const s = supa();
  if (s) {
    const { error } = await s.from('portal_enquiries').update(patch).eq('id', id);
    if (error) throw error;
    return;
  }
  const all = await loadLocal();
  const e = all.find((x) => x.id === id);
  if (e) {
    e.handledAt = patch.handled_at;
    e.handledBy = patch.handled_by;
    await saveLocal(all);
  }
}
