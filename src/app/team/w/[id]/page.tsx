import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Uploader } from '@/components/portal/Uploader';
import { INTAKE_FIELDS } from '@/lib/portal/intake';
import { portalStore } from '@/lib/portal/store';
import { requireTeam } from '@/lib/portal/team';
import { STATUS_LABEL, TIER_LABEL } from '@/lib/portal/types';
import { TeamShell } from '../../TeamShell';
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

  return (
    <TeamShell email={email} active="workshops">
      <p className="tm-crumb"><Link href="/team">Workshops</Link> /</p>
      <div className="tm-head">
        <h1>{w.clientName}</h1>
        <span className={`tm-status s-${w.status}`}>{STATUS_LABEL[w.status]}</span>
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
          </dl>
        </section>

        <div className="tm-col">
          <section className="tm-card">
            <h2>Files</h2>
            <Uploader workshopId={w.id} files={files} />
            {w.driveFolderUrl && (
              <p className="tm-drive">
                Google Drive: <a href={w.driveFolderUrl} target="_blank" rel="noreferrer">open folder ↗</a>
              </p>
            )}
          </section>

          <section className="tm-card">
            <h2>Workshop</h2>
            <WorkshopForm id={w.id} status={w.status} driveFolderUrl={w.driveFolderUrl} teamNotes={w.teamNotes} />
            <p className="tm-muted tm-small">
              Client&apos;s private link: <code>/start/{w.token.slice(0, 6)}…</code>{' '}
              <a href={`/start/${w.token}`} target="_blank" rel="noreferrer">open as client ↗</a>
            </p>
          </section>
        </div>
      </div>

      {w.tier === 'self_serve' && <TeamAnswers w={w} voice={voice} />}
    </TeamShell>
  );
}
