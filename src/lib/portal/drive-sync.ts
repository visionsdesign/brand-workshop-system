// One-way copy of each workshop into the Visions Shared Drive, so the team
// finds everything in Drive as well as in the app:
//
//   <Shared Drive folder>/
//     Acme Ltd (Self-serve, 13 Oct 2026)/
//       Intake            (Google Doc: the intake, plus the intake conversation)
//       Workshop answers  (Google Doc, self-serve: every answer and AI conversation)
//       Files/            (everything uploaded, as it arrives)
//
// Set GOOGLE_DRIVE_SYNC_FOLDER to a folder in a Shared Drive where the service
// account is a Content manager. The app stays the source of truth: files
// deleted in the app stay in Drive, and the documents are rewritten on each sync.
import { after } from 'next/server';
import { driveConfigured, ensureFolder, folderIdFromUrl, replaceDoc, uploadBytes } from './drive';
import { INTAKE_FIELDS, MOVED_INTAKE_FIELDS } from './intake';
import { answersMarkdown } from './selfserve';
import { portalStore } from './store';
import { TIER_LABEL, type PortalWorkshop, type WorkshopFile } from './types';

const SITE = process.env.URL || 'https://brand.visionsdesign.co.uk';

const rootFolder = () => {
  const v = (process.env.GOOGLE_DRIVE_SYNC_FOLDER ?? '').trim();
  return v ? folderIdFromUrl(v) ?? v : '';
};

export const driveSyncConfigured = () => driveConfigured() && Boolean(rootFolder());

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

/** The workshop's folder in the Shared Drive, created the first time */
async function workshopFolder(w: PortalWorkshop): Promise<string> {
  if (w.driveSyncFolderId) return w.driveSyncFolderId;
  const name = `${w.clientName} (${TIER_LABEL[w.tier]}, ${day(w.createdAt)})`.replace(/[/\\]/g, '-');
  const id = await ensureFolder(name, rootFolder());
  await portalStore().updateWorkshop(w.id, { driveSyncFolderId: id });
  w.driveSyncFolderId = id;
  return id;
}

function intakeMarkdown(w: PortalWorkshop): string {
  const lines = [`# ${w.clientName}: intake`, '', `Contact: ${w.contactName} (${w.contactEmail})`, `Workshop: ${TIER_LABEL[w.tier]}`, ''];
  for (const f of [...INTAKE_FIELDS, ...MOVED_INTAKE_FIELDS]) {
    const v = w.intake[f.key]?.trim();
    if (v) lines.push(`## ${f.label}`, '', v, '');
  }
  const chat = w.answers?.INTAKE?.chat ?? [];
  if (chat.length) {
    lines.push('## Intake conversation', '');
    for (const t of chat) lines.push(`**${t.role === 'user' ? 'Client' : 'AI'}:** ${t.content.replace(/\n+/g, ' ')}`, '');
  }
  return lines.join('\n');
}

async function copyFile(f: WorkshopFile, folderId: string) {
  if (f.driveFileId) return false;
  const bytes = await portalStore().readBlob(f.path);
  if (!bytes) return false;
  const id = await uploadBytes(folderId, f.name, f.type, bytes);
  await portalStore().setFileDriveId(f.id, id);
  return true;
}

export interface SyncResult {
  folderId: string;
  files: number;
}

// One sync at a time per workshop on this server, so quick uploads don't copy a file twice
const running = new Map<string, Promise<unknown>>();

/** Bring the workshop's Drive folder up to date: documents rewritten, new files copied */
export function syncWorkshop(workshopId: string): Promise<SyncResult | null> {
  const next = (running.get(workshopId) ?? Promise.resolve()).catch(() => undefined).then(() => runSync(workshopId));
  running.set(workshopId, next);
  next.finally(() => { if (running.get(workshopId) === next) running.delete(workshopId); }).catch(() => undefined);
  return next;
}

async function runSync(workshopId: string): Promise<SyncResult | null> {
  if (!driveSyncConfigured()) return null;
  const store = portalStore();
  const w = await store.getById(workshopId);
  if (!w) return null;
  const folderId = await workshopFolder(w);
  if (w.intakeDone || Object.keys(w.intake).length > 1) await replaceDoc(folderId, 'Intake', intakeMarkdown(w));
  const files = await store.listFiles(w.id);
  const slideAnswers = Object.keys(w.answers ?? {}).filter((k) => k !== 'INTAKE');
  if (w.tier === 'self_serve' && (slideAnswers.length || files.some((f) => f.slideId))) {
    await replaceDoc(folderId, 'Workshop answers', answersMarkdown(w, files, SITE));
  }
  const pending = files.filter((f) => !f.driveFileId);
  let copied = 0;
  if (pending.length) {
    const filesFolder = await ensureFolder('Files', folderId);
    for (const f of pending) if (await copyFile(f, filesFolder)) copied++;
  }
  return { folderId, files: copied };
}

/**
 * Sync after the response has gone, so the client never waits on Drive.
 * Failures are logged; the team can always press "Sync to Drive now".
 */
export function syncLater(workshopId: string) {
  if (!driveSyncConfigured()) return;
  after(async () => {
    try {
      await syncWorkshop(workshopId);
    } catch (err) {
      console.error('Drive sync failed', workshopId, err);
    }
  });
}
