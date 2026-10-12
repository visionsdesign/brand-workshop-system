'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPin } from '@/lib/auth';
import { portalStore, usingSupabase } from '@/lib/portal/store';
import { clearTeamSession, isTeamEmail, requireTeam, setTeamSession, teamDomain } from '@/lib/portal/team';
import type { Tier, WorkshopStatus } from '@/lib/portal/types';

export interface FormState {
  error?: string;
  ok?: string;
  /** What was submitted, so the form keeps it after React resets the fields */
  values?: Record<string, string>;
}

/** Local sign-in, used only while Supabase isn't configured */
export async function pinLogin(_prev: FormState | undefined, form: FormData): Promise<FormState> {
  if (usingSupabase()) return { error: 'Use the email sign-in.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!isTeamEmail(email)) return { error: `Use your @${teamDomain()} email.` };
  if (!checkPin(String(form.get('pin') ?? ''))) return { error: 'That PIN is not right.' };
  await setTeamSession(email);
  redirect('/team');
}

export async function logout() {
  await clearTeamSession();
  redirect('/team/login');
}

export async function createCode(_prev: FormState | undefined, form: FormData): Promise<FormState> {
  const email = await requireTeam();
  const tier = form.get('tier') === 'self_serve' ? 'self_serve' : ('guided' as Tier);
  const label = String(form.get('label') ?? '').trim().slice(0, 120);
  const maxUses = Math.min(50, Math.max(1, Number(form.get('maxUses') ?? 1) || 1));
  const days = Number(form.get('days') ?? 0);
  const expiresAt = days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null;
  const code = await portalStore().createCode({ tier, label, maxUses, expiresAt, createdBy: email });
  revalidatePath('/team/codes');
  return { ok: code.code };
}

const STATUSES: WorkshopStatus[] = ['intake', 'ready', 'booked', 'in_progress', 'submitted', 'complete'];

export async function updateWorkshop(id: string, _prev: FormState | undefined, form: FormData): Promise<FormState> {
  await requireTeam();
  const status = String(form.get('status') ?? '') as WorkshopStatus;
  const drive = String(form.get('driveFolderUrl') ?? '').trim();
  const values = { status, driveFolderUrl: drive, teamNotes: String(form.get('teamNotes') ?? '') };
  if (drive && !/^https:\/\/drive\.google\.com\//.test(drive)) {
    return { error: 'The Drive link should start with https://drive.google.com/', values };
  }
  await portalStore().updateWorkshop(id, {
    ...(STATUSES.includes(status) ? { status } : {}),
    driveFolderUrl: drive,
    teamNotes: String(form.get('teamNotes') ?? '').slice(0, 10000),
  });
  revalidatePath(`/team/w/${id}`);
  revalidatePath('/team');
  return { ok: 'Saved', values };
}
