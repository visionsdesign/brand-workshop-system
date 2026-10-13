// Usage counters for public endpoints. Supabase (vivi_hit) when configured, so
// limits hold across serverless instances; an in-memory map otherwise.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const g = globalThis as unknown as { __hits?: Map<string, number> };
const mem = (g.__hits ??= new Map());
let db: SupabaseClient | null = null;

/** Add one to a bucket and return the new count */
export async function hit(bucket: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    db ??= createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.rpc('vivi_hit', { p_bucket: bucket });
    if (!error && typeof data === 'number') return data;
    console.error('rate limit counter failed', error);
    // Fall through to memory rather than failing the request
  }
  const n = (mem.get(bucket) ?? 0) + 1;
  mem.set(bucket, n);
  return n;
}

/** A stable, anonymous visitor ID from the request's IP (hashed, never stored raw) */
export function visitorId(req: Request): string {
  const ip =
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return createHash('sha256').update(`${process.env.SESSION_SECRET ?? ''}|${ip}`).digest('hex').slice(0, 24);
}
