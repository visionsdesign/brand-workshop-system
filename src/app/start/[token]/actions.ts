'use server';

import { revalidatePath } from 'next/cache';
import { INTAKE_FIELDS, intakeComplete } from '@/lib/portal/intake';
import { portalStore } from '@/lib/portal/store';
import type { Intake } from '@/lib/portal/types';

export interface IntakeState {
  saved?: boolean;
  error?: string;
  /** What was submitted, so the form keeps it after React resets the fields */
  values?: Intake;
}

export async function saveIntake(token: string, _prev: IntakeState | undefined, form: FormData): Promise<IntakeState> {
  const store = portalStore();
  const w = await store.getByToken(token);
  if (!w) return { error: 'This workshop link is no longer valid.' };

  const intake: Intake = { ...w.intake };
  for (const f of INTAKE_FIELDS) intake[f.key] = String(form.get(f.key) ?? '').slice(0, 4000);

  const finishing = form.get('intent') === 'finish';
  if (finishing && !intakeComplete(intake)) {
    await store.updateWorkshop(w.id, { intake });
    revalidatePath(`/start/${token}`);
    return { error: 'Please answer the questions marked as required.', values: intake };
  }
  const intakeDone = w.intakeDone || finishing;
  await store.updateWorkshop(w.id, {
    intake,
    intakeDone,
    clientName: intake.company?.trim() || w.clientName,
    status: w.status === 'intake' && intakeDone ? 'ready' : w.status,
  });
  revalidatePath(`/start/${token}`);
  return { saved: true, values: intake };
}

/** Step 2: the client has shared their files, or has nothing to share */
export async function setFilesStep(token: string, value: 'done' | 'skipped' | null) {
  const store = portalStore();
  const w = await store.getByToken(token);
  if (!w) return;
  const intake: Intake = { ...w.intake };
  if (value) intake.filesStep = value;
  else delete intake.filesStep;
  await store.updateWorkshop(w.id, { intake });
  revalidatePath(`/start/${token}`);
}
