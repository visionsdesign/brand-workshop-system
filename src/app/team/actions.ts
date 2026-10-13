'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPin } from '@/lib/auth';
import { portalStore, usingSupabase } from '@/lib/portal/store';
import { clearTeamSession, isTeamEmail, requireTeam, setTeamSession, teamDomain } from '@/lib/portal/team';
import type { Tier, WorkshopStatus } from '@/lib/portal/types';
import { driveSyncConfigured, syncLater, syncWorkshop } from '@/lib/portal/drive-sync';
import { DriveError, folderUrl } from '@/lib/portal/drive';

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
  const current = await portalStore().getById(id);
  await portalStore().updateWorkshop(id, {
    ...(STATUSES.includes(status) ? { status } : {}),
    // Picking Complete from the list counts as completing it
    ...(status === 'complete' && current?.status !== 'complete' ? { completedAt: new Date().toISOString() } : {}),
    driveFolderUrl: drive,
    teamNotes: String(form.get('teamNotes') ?? '').slice(0, 10000),
  });
  revalidatePath(`/team/w/${id}`);
  revalidatePath('/team');
  return { ok: 'Saved', values };
}

export type LifecycleAction = 'complete' | 'reopen' | 'archive' | 'unarchive';

/** The team's buttons on a workshop: mark it complete, reopen it for the client, archive or unarchive it */
export async function setLifecycle(id: string, action: LifecycleAction): Promise<FormState> {
  await requireTeam();
  const store = portalStore();
  const w = await store.getById(id);
  if (!w) return { error: 'Workshop not found.' };
  const now = new Date().toISOString();
  const patch =
    action === 'complete' ? { status: 'complete' as const, completedAt: now }
    : action === 'reopen' ? {
        // Back to where the client was before it was finished
        status: (w.tier === 'self_serve' ? 'in_progress' : w.booking && w.booking.status !== 'cancelled' ? 'booked' : 'ready') as WorkshopStatus,
        completedAt: null,
        ...(w.tier === 'self_serve' ? { submittedAt: null } : {}),
      }
    : action === 'archive' ? { archivedAt: now }
    : { archivedAt: null };
  try {
    await store.updateWorkshop(id, patch);
  } catch (err) {
    console.error('workshop lifecycle change failed', err);
    return { error: 'That did not save. If this is new, run the latest supabase/schema.sql in Supabase first.' };
  }
  if (action === 'complete') syncLater(id);
  revalidatePath(`/team/w/${id}`);
  revalidatePath('/team');
  revalidatePath(`/start/${w.token}`);
  return { ok: { complete: 'Marked complete', reopen: 'Reopened for the client', archive: 'Archived', unarchive: 'Unarchived' }[action] };
}

/** "Sync to Drive now" on a workshop: copies anything new and rewrites the documents */
export async function syncToDrive(id: string): Promise<FormState & { url?: string }> {
  await requireTeam();
  if (!driveSyncConfigured()) return { error: 'Drive sync is not set up. Add GOOGLE_DRIVE_SYNC_FOLDER and the Google keys.' };
  try {
    const r = await syncWorkshop(id);
    if (!r) return { error: 'Workshop not found.' };
    revalidatePath(`/team/w/${id}`);
    return { ok: r.files ? `Synced, ${r.files} new file${r.files === 1 ? '' : 's'} copied` : 'Synced, everything is up to date', url: folderUrl(r.folderId) };
  } catch (err) {
    console.error('Drive sync failed', id, err);
    const hint = err instanceof DriveError && (err.status === 403 || err.status === 404)
      ? ' Check the service account is a Content manager of the Shared Drive.'
      : '';
    return { error: `Drive sync did not work.${hint}` };
  }
}
