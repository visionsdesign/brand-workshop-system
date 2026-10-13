import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Uploader } from '@/components/portal/Uploader';
import { INTAKE_FIELDS, MOVED_INTAKE_FIELDS } from '@/lib/portal/intake';
import { portalStore, usingSupabase } from '@/lib/portal/store';
import { requireTeam } from '@/lib/portal/team';
import { STATUS_LABEL, TIER_LABEL } from '@/lib/portal/types';
import { TeamShell } from '../../TeamShell';
import { DriveFiles } from './DriveFiles';
import { Lifecycle } from './Lifecycle';
import { DriveSync } from './DriveSync';
import { driveSyncConfigured } from '@/lib/portal/drive-sync';
import { folderUrl } from '@/lib/portal/drive';
import { TeamAnswers } from './TeamAnswers';
import { WorkshopForm } from './WorkshopForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workshop · Visions team' };

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function TeamWorkshop({ params }: { params: Promise<{ id: string }> }) {
  const email = await requireTeam();
  const { id } = await params;
  const store = portalStore();
  const w = await store.getById(id);
  if (!w) notFound();
  const allFiles = await store.listFiles(w.id);
  const files = allFiles.filter((f) => !f.slideId);
  const voice = allFiles.filter((f) => f.slideId);
  // The Supabase project behind SUPABASE_URL, for links into its dashboard
  const ref = usingSupabase() ? new URL(process.env.SUPABASE_URL ?? 'https://x.supabase.co').hostname.split('.')[0] : '';
  const dash = `https://supabase.com/dashboard/project/${ref}`;

  return (
    <TeamShell email={email} active="workshops">
      <p className="tm-crumb"><Link href="/team">Workshops</Link> /</p>
      <div className="tm-head">
        <h1>{w.clientName}</h1>
        <span className={`tm-status s-${w.status}`}>{STATUS_LABEL[w.status]}</span>
        {w.archivedAt && <span className="tm-status s-archived">Archived</span>}
      </div>
      <p className="tm-sub">
        {TIER_LABEL[w.tier]} · {w.contactName}, <a href={`mailto:${w.contactEmail}`}>{w.contactEmail}</a> · started {when(w.createdAt)}
        {w.code && <> · code <code>{w.code}</code></>}
        {w.amountPaid ? <> · paid online {(w.amountPaid / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}</> : null}
      </p>

      {w.tier === 'guided' && (
        <p className={`tm-booking ${w.booking?.status ?? 'none'}`}>
          {w.booking && w.booking.status !== 'cancelled'
            ? <>Session {w.booking.status === 'pending' ? 'booked (awaiting Cal.com confirmation)' : 'booked'}: <b>{w.booking.start ? when(w.booking.start) : 'time to follow'}</b></>
            : w.booking?.status === 'cancelled'
              ? 'The client cancelled their booking.'
              : 'No session booked yet.'}
        </p>
      )}

      <div className="tm-lifecycle-row">
        <Lifecycle id={w.id} status={w.status} archived={Boolean(w.archivedAt)} />
        <span className="tm-muted tm-small">
          {w.submittedAt && <>Submitted {when(w.submittedAt)}. </>}
          {w.completedAt && <>Completed {when(w.completedAt)}. </>}
          {w.archivedAt && <>Archived {when(w.archivedAt)}.</>}
        </span>
      </div>

      <div className="tm-grid">
        <section className="tm-card">
          <h2>Intake {!w.intakeDone && <small className="tm-pending">not finished</small>}</h2>
          <dl className="tm-intake">
            {INTAKE_FIELDS.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{w.intake[f.key]?.trim() || <span className="tm-muted">Not answered</span>}</dd>
              </div>
            ))}
            {/* Older workshops answered the opening questions here, before they moved to slides O01 to O03 */}
            {MOVED_INTAKE_FIELDS.filter((f) => w.intake[f.key]?.trim()).map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{w.intake[f.key]}</dd>
              </div>
            ))}
          </dl>
          {w.answers?.INTAKE?.chat?.length ? (
            <details className="tm-intake-chat">
              <summary>Intake conversation ({w.answers.INTAKE.chat.length} messages)</summary>
              <div className="tm-vivi-turns">
                {w.answers.INTAKE.chat.map((t, i) => (
                  <p key={i} className={t.role === 'user' ? 'is-user' : ''}>
                    <span className="who">{t.role === 'user' ? 'Client' : 'AI'}</span>
                    {t.content}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <div className="tm-col">
          <section className="tm-card">
            <h2>Files</h2>
            <Uploader workshopId={w.id} files={files} />
          </section>

          {w.driveFolderUrl && (
            <section className="tm-card">
              <h2>Google Drive</h2>
              <DriveFiles workshopId={w.id} folderUrl={w.driveFolderUrl} />
            </section>
          )}

          <section className="tm-card">
            <h2>Workshop</h2>
            <WorkshopForm id={w.id} status={w.status} driveFolderUrl={w.driveFolderUrl} teamNotes={w.teamNotes} />
            <p className="tm-muted tm-small">
              Client&apos;s private link: <code>/start/{w.token.slice(0, 6)}…</code>{' '}
              <a href={`/start/${w.token}`} target="_blank" rel="noreferrer">open as client ↗</a>
            </p>
          </section>

          <section className="tm-card">
            <h2>Where it&apos;s stored</h2>
            <ul className="tm-stored">
              {ref ? (
                <>
                  <li>
                    <a href={`${dash}/editor`} target="_blank" rel="noreferrer">Database ↗</a>
                    <span>Supabase, table <code>portal_workshops</code>, id <code>{w.id}</code>: intake, answers, AI conversations, booking</span>
                  </li>
                  <li>
                    <a href={`${dash}/storage/buckets/workshop-files`} target="_blank" rel="noreferrer">Files ↗</a>
                    <span>Supabase Storage, bucket <code>workshop-files</code>, folder <code>{w.id}</code> ({allFiles.length} file{allFiles.length === 1 ? '' : 's'})</span>
                  </li>
                </>
              ) : (
                <li>
                  <span>This computer only: <code>.data/portal.json</code> and <code>.data/files/{w.id}/</code></span>
                </li>
              )}
              {driveSyncConfigured() ? (
                <li>
                  {w.driveSyncFolderId ? (
                    <a href={folderUrl(w.driveSyncFolderId)} target="_blank" rel="noreferrer">Visions Drive folder ↗</a>
                  ) : (
                    <b>Visions Drive folder</b>
                  )}
                  <span>
                    Copied automatically: intake, answers and {allFiles.filter((f) => f.driveFileId).length} of {allFiles.length} file{allFiles.length === 1 ? '' : 's'}.
                    {!w.driveSyncFolderId && ' Created on the first sync.'}
                  </span>
                  <DriveSync id={w.id} />
                </li>
              ) : (
                <li><span className="tm-muted">Drive sync is off. Set GOOGLE_DRIVE_SYNC_FOLDER to copy each workshop into the Shared Drive.</span></li>
              )}
              {w.driveFolderUrl ? (
                <li>
                  <a href={w.driveFolderUrl} target="_blank" rel="noreferrer">Client&apos;s Google Drive ↗</a>
                  <span>The folder the client shared with us</span>
                </li>
              ) : (
                <li><span className="tm-muted">No client Drive folder linked. Add one above if they shared one.</span></li>
              )}
              {w.tier === 'self_serve' && (
                <li>
                  <a href={`/api/portal/answers/export?workshopId=${w.id}`}>Answers (.md) ↓</a>
                  <span>Every answer and conversation in one file, for Capture</span>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>

      {w.tier === 'self_serve' && <TeamAnswers w={w} voice={voice} />}
    </TeamShell>
  );
}
