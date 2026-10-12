// Portal persistence. Supabase (service role, server only) when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set; otherwise a JSON file and a files folder
// under .data/, which is enough to run the portal on one machine.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AccessCode, PortalWorkshop, SelfServeAnswers, SlideAnswer, Tier, WorkshopFile } from './types';

export const BUCKET = 'workshop-files';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type RedeemResult = { workshop: PortalWorkshop } | { error: string };

export interface NewCode {
  tier: Tier;
  label: string;
  maxUses: number;
  expiresAt: string | null;
  createdBy: string;
}

export interface Contact {
  clientName: string;
  contactName: string;
  contactEmail: string;
}

export interface Purchase {
  tier: Tier;
  contact: Contact;
  sessionId: string;
  amountPaid: number;
}

/** Where the browser should send a file's bytes */
export type UploadTarget =
  | { kind: 'local'; path: string }
  | { kind: 'supabase'; path: string; signedUrl: string };

export interface PortalStore {
  createCode(c: NewCode): Promise<AccessCode>;
  listCodes(): Promise<AccessCode[]>;
  redeemCode(code: string, contact: Contact): Promise<RedeemResult>;
  /** Create the workshop for a paid Stripe Checkout session. Idempotent: the same session always returns the same workshop. */
  createFromPurchase(p: Purchase): Promise<PortalWorkshop>;
  getByStripeSession(sessionId: string): Promise<PortalWorkshop | null>;
  getByToken(token: string): Promise<PortalWorkshop | null>;
  getById(id: string): Promise<PortalWorkshop | null>;
  listWorkshops(): Promise<PortalWorkshop[]>;
  updateWorkshop(id: string, patch: Partial<PortalWorkshop>): Promise<PortalWorkshop | null>;
  /** Merge one slide's self-serve answer (parts and values merge key by key) and return all answers */
  mergeAnswer(workshopId: string, slideId: string, patch: SlideAnswer): Promise<SelfServeAnswers>;
  uploadTarget(workshopId: string, name: string): Promise<UploadTarget>;
  writeLocal(path: string, bytes: Uint8Array): Promise<void>;
  addFile(f: Omit<WorkshopFile, 'id' | 'createdAt'>): Promise<WorkshopFile>;
  listFiles(workshopId: string): Promise<WorkshopFile[]>;
  getFile(id: string): Promise<WorkshopFile | null>;
  /** Local: the bytes. Supabase: a short-lived signed URL to redirect to. */
  download(f: WorkshopFile): Promise<{ bytes: Uint8Array } | { url: string }>;
  deleteFile(id: string): Promise<void>;
}

// ---------- shared helpers ----------

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function chunk(n: number) {
  const b = randomBytes(n);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
}
export const newCode = () => `VIS-${chunk(4)}-${chunk(4)}`;
export const newToken = () => randomBytes(24).toString('base64url');
export const normaliseCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');
const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file';

/** Shallow merge, except parts and values, which merge key by key */
export function mergeSlideAnswer(old: SlideAnswer | undefined, patch: SlideAnswer): SlideAnswer {
  const next: SlideAnswer = { ...old, ...patch, updatedAt: new Date().toISOString() };
  if (patch.parts) next.parts = { ...old?.parts, ...patch.parts };
  if (patch.values) next.values = { ...old?.values, ...patch.values };
  return next;
}

function codeProblem(c: AccessCode | null | undefined): string | null {
  if (!c) return 'That code was not recognised. Check it and try again.';
  if (c.uses >= c.maxUses) return 'That code has already been used.';
  if (c.expiresAt && Date.parse(c.expiresAt) < Date.now()) return 'That code has expired.';
  return null;
}

function blankWorkshop(tier: Tier, contact: Contact, code: string | null): PortalWorkshop {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    token: newToken(),
    tier,
    status: 'intake',
    clientName: contact.clientName,
    contactName: contact.contactName,
    contactEmail: contact.contactEmail,
    intake: { company: contact.clientName },
    intakeDone: false,
    driveFolderUrl: '',
    teamNotes: '',
    answers: {},
    submittedAt: null,
    stripeSessionId: null,
    amountPaid: null,
    booking: null,
    code,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- local (JSON file + .data/files) ----------

interface LocalDb {
  workshops: PortalWorkshop[];
  codes: AccessCode[];
  files: WorkshopFile[];
}

const DATA_DIR = join(process.cwd(), '.data');
const DB_FILE = join(DATA_DIR, 'portal.json');
const FILES_DIR = join(DATA_DIR, 'files');

// Serialise writes so two quick requests can't clobber each other
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function load(): Promise<LocalDb> {
  try {
    return JSON.parse(await readFile(DB_FILE, 'utf8')) as LocalDb;
  } catch {
    return { workshops: [], codes: [], files: [] };
  }
}
async function save(db: LocalDb) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_FILE);
}

const localStore: PortalStore = {
  createCode: (c) =>
    serial(async () => {
      const db = await load();
      const code: AccessCode = { ...c, code: newCode(), uses: 0, createdAt: new Date().toISOString() };
      db.codes.unshift(code);
      await save(db);
      return code;
    }),
  listCodes: async () => (await load()).codes,
  redeemCode: (raw, contact) =>
    serial(async () => {
      const db = await load();
      const c = db.codes.find((x) => x.code === normaliseCode(raw));
      const problem = codeProblem(c);
      if (problem || !c) return { error: problem ?? 'Unknown code.' };
      c.uses += 1;
      const w = blankWorkshop(c.tier, contact, c.code);
      db.workshops.unshift(w);
      await save(db);
      return { workshop: w };
    }),
  createFromPurchase: (p) =>
    serial(async () => {
      const db = await load();
      const existing = db.workshops.find((w) => w.stripeSessionId === p.sessionId);
      if (existing) return existing;
      const w = { ...blankWorkshop(p.tier, p.contact, null), stripeSessionId: p.sessionId, amountPaid: p.amountPaid };
      db.workshops.unshift(w);
      await save(db);
      return w;
    }),
  getByStripeSession: async (id) => (await load()).workshops.find((w) => w.stripeSessionId === id) ?? null,
  getByToken: async (token) => (await load()).workshops.find((w) => w.token === token) ?? null,
  getById: async (id) => (await load()).workshops.find((w) => w.id === id) ?? null,
  listWorkshops: async () => (await load()).workshops,
  updateWorkshop: (id, patch) =>
    serial(async () => {
      const db = await load();
      const w = db.workshops.find((x) => x.id === id);
      if (!w) return null;
      Object.assign(w, patch, { id: w.id, token: w.token, updatedAt: new Date().toISOString() });
      await save(db);
      return w;
    }),
  mergeAnswer: (workshopId, slideId, patch) =>
    serial(async () => {
      const db = await load();
      const w = db.workshops.find((x) => x.id === workshopId);
      if (!w) throw new Error('workshop not found');
      w.answers = { ...w.answers, [slideId]: mergeSlideAnswer(w.answers?.[slideId], patch) };
      w.updatedAt = new Date().toISOString();
      await save(db);
      return w.answers;
    }),
  uploadTarget: async (workshopId, name) => ({ kind: 'local', path: `${workshopId}/${randomUUID()}-${safeName(name)}` }),
  writeLocal: async (path, bytes) => {
    const full = join(FILES_DIR, path);
    if (!full.startsWith(FILES_DIR + '/')) throw new Error('bad path');
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
  },
  addFile: (f) =>
    serial(async () => {
      const db = await load();
      const file: WorkshopFile = { ...f, id: randomUUID(), createdAt: new Date().toISOString() };
      db.files.unshift(file);
      await save(db);
      return file;
    }),
  listFiles: async (workshopId) => (await load()).files.filter((f) => f.workshopId === workshopId),
  getFile: async (id) => (await load()).files.find((f) => f.id === id) ?? null,
  download: async (f) => ({ bytes: new Uint8Array(await readFile(join(FILES_DIR, f.path))) }),
  deleteFile: (id) =>
    serial(async () => {
      const db = await load();
      const f = db.files.find((x) => x.id === id);
      if (!f) return;
      db.files = db.files.filter((x) => x.id !== id);
      await save(db);
      await rm(join(FILES_DIR, f.path), { force: true });
    }),
};

// ---------- supabase ----------

const rowToWorkshop = (r: Record<string, any>): PortalWorkshop => ({
  id: r.id,
  token: r.token,
  tier: r.tier,
  status: r.status,
  clientName: r.client_name,
  contactName: r.contact_name,
  contactEmail: r.contact_email,
  intake: r.intake ?? {},
  intakeDone: r.intake_done,
  driveFolderUrl: r.drive_folder_url ?? '',
  teamNotes: r.team_notes ?? '',
  answers: r.answers ?? {},
  submittedAt: r.submitted_at ?? null,
  stripeSessionId: r.stripe_session_id ?? null,
  amountPaid: r.amount_paid ?? null,
  booking: r.booking ?? null,
  code: r.code,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const workshopToRow = (w: Partial<PortalWorkshop>) => {
  const map: Record<string, string> = {
    tier: 'tier', status: 'status', clientName: 'client_name', contactName: 'contact_name',
    contactEmail: 'contact_email', intake: 'intake', intakeDone: 'intake_done',
    driveFolderUrl: 'drive_folder_url', teamNotes: 'team_notes', submittedAt: 'submitted_at',
    stripeSessionId: 'stripe_session_id', amountPaid: 'amount_paid', booking: 'booking',
  };
  // answers are only written through portal_merge_answer, never wholesale
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map)) if (k in w) row[col] = (w as Record<string, unknown>)[k];
  return row;
};
const rowToCode = (r: Record<string, any>): AccessCode => ({
  code: r.code, tier: r.tier, label: r.label ?? '', maxUses: r.max_uses, uses: r.uses,
  expiresAt: r.expires_at, createdBy: r.created_by ?? '', createdAt: r.created_at,
});
const rowToFile = (r: Record<string, any>): WorkshopFile => ({
  id: r.id, workshopId: r.workshop_id, name: r.name, size: r.size, type: r.type ?? '',
  path: r.path, uploadedBy: r.uploaded_by, slideId: r.slide_id ?? null, transcript: r.transcript ?? null,
  seconds: r.seconds === null || r.seconds === undefined ? null : Number(r.seconds), createdAt: r.created_at,
});

function supabaseStore(db: SupabaseClient): PortalStore {
  // Throw on a Supabase error; maybeSingle() lookups use `found` below, everything else must return data
  // Untyped client (no generated DB types), so rows come back as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const must = (res: { data: any; error: unknown }): any => {
    if (res.error) throw res.error;
    if (res.data === null) throw new Error('Supabase returned no data');
    return res.data;
  };
  const found = <T>(res: { data: T | null; error: unknown }): T | null => {
    if (res.error) throw res.error;
    return res.data;
  };
  return {
    async createCode(c) {
      const row = must(await db.from('portal_codes').insert({
        code: newCode(), tier: c.tier, label: c.label, max_uses: c.maxUses,
        expires_at: c.expiresAt, created_by: c.createdBy,
      }).select().single());
      return rowToCode(row);
    },
    async listCodes() {
      return must(await db.from('portal_codes').select('*').order('created_at', { ascending: false })).map(rowToCode);
    },
    async redeemCode(raw, contact) {
      const codeStr = normaliseCode(raw);
      const hit = found(await db.from('portal_codes').select('*').eq('code', codeStr).maybeSingle());
      const c = hit ? rowToCode(hit) : null;
      const problem = codeProblem(c);
      if (problem || !c) return { error: problem ?? 'Unknown code.' };
      // Only count the use if nobody else used it in the meantime
      const claimed = must(await db.from('portal_codes').update({ uses: c.uses + 1 })
        .eq('code', codeStr).eq('uses', c.uses).select());
      if (!claimed.length) return { error: 'That code has just been used. Try again or contact us.' };
      const w = blankWorkshop(c.tier, contact, c.code);
      // New workshops start unsubmitted; leave submitted_at to its column default
      const { submittedAt: _s, stripeSessionId: _p, amountPaid: _a, booking: _b, ...fresh } = w;
      try {
        const row = must(await db.from('portal_workshops').insert({
          id: w.id, token: w.token, code: w.code, ...workshopToRow(fresh),
        }).select().single());
        return { workshop: rowToWorkshop(row) };
      } catch (err) {
        // Give the use back so the client can try again with the same code
        await db.from('portal_codes').update({ uses: c.uses }).eq('code', codeStr).eq('uses', c.uses + 1);
        throw err;
      }
    },
    async createFromPurchase(p) {
      const existing = await this.getByStripeSession(p.sessionId);
      if (existing) return existing;
      const w = blankWorkshop(p.tier, p.contact, null);
      const { submittedAt: _s, booking: _b, ...fresh } = w;
      const res = await db.from('portal_workshops').insert({
        id: w.id, token: w.token, ...workshopToRow({ ...fresh, stripeSessionId: p.sessionId, amountPaid: p.amountPaid }),
      }).select().single();
      if (res.error) {
        // The webhook and the success page can race; the unique index lets only one insert win
        const winner = await this.getByStripeSession(p.sessionId);
        if (winner) return winner;
        throw res.error;
      }
      return rowToWorkshop(res.data);
    },
    async getByStripeSession(id) {
      const r = found(await db.from('portal_workshops').select('*').eq('stripe_session_id', id).maybeSingle());
      return r ? rowToWorkshop(r) : null;
    },
    async getByToken(token) {
      const r = found(await db.from('portal_workshops').select('*').eq('token', token).maybeSingle());
      return r ? rowToWorkshop(r) : null;
    },
    async getById(id) {
      const r = found(await db.from('portal_workshops').select('*').eq('id', id).maybeSingle());
      return r ? rowToWorkshop(r) : null;
    },
    async listWorkshops() {
      return must(await db.from('portal_workshops').select('*').order('created_at', { ascending: false })).map(rowToWorkshop);
    },
    async updateWorkshop(id, patch) {
      const r = found(await db.from('portal_workshops')
        .update({ ...workshopToRow(patch), updated_at: new Date().toISOString() })
        .eq('id', id).select().maybeSingle());
      return r ? rowToWorkshop(r) : null;
    },
    async mergeAnswer(workshopId, slideId, patch) {
      const answers = must(await db.rpc('portal_merge_answer', {
        p_id: workshopId,
        p_slide: slideId,
        p_val: { ...patch, updatedAt: new Date().toISOString() },
      }));
      return answers as SelfServeAnswers;
    },
    async uploadTarget(workshopId, name) {
      const path = `${workshopId}/${randomUUID()}-${safeName(name)}`;
      const { signedUrl } = must(await db.storage.from(BUCKET).createSignedUploadUrl(path));
      return { kind: 'supabase', path, signedUrl };
    },
    async writeLocal() {
      throw new Error('Uploads go straight to Supabase Storage');
    },
    async addFile(f) {
      const row = must(await db.from('portal_files').insert({
        workshop_id: f.workshopId, name: f.name, size: f.size, type: f.type, path: f.path, uploaded_by: f.uploadedBy,
        slide_id: f.slideId, transcript: f.transcript, seconds: f.seconds,
      }).select().single());
      return rowToFile(row);
    },
    async listFiles(workshopId) {
      return must(await db.from('portal_files').select('*').eq('workshop_id', workshopId)
        .order('created_at', { ascending: false })).map(rowToFile);
    },
    async getFile(id) {
      const r = found(await db.from('portal_files').select('*').eq('id', id).maybeSingle());
      return r ? rowToFile(r) : null;
    },
    async download(f) {
      const { signedUrl } = must(await db.storage.from(BUCKET).createSignedUrl(f.path, 120, { download: f.name }));
      return { url: signedUrl };
    },
    async deleteFile(id) {
      const f = await this.getFile(id);
      if (!f) return;
      await db.storage.from(BUCKET).remove([f.path]);
      must(await db.from('portal_files').delete().eq('id', id));
    },
  };
}

let store: PortalStore | null = null;
export function portalStore(): PortalStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? supabaseStore(createClient(url, key, { auth: { persistSession: false } })) : localStore;
  return store;
}

export const usingSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
