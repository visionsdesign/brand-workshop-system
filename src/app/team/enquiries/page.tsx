import { INTEREST_LABEL, listEnquiries } from '@/lib/portal/enquiries';
import { requireTeam } from '@/lib/portal/team';
import { TeamShell } from '../TeamShell';
import { HandledButton } from './HandledButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries · Visions team' };

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** People who left their details on the landing page to talk through their options */
export default async function Enquiries() {
  const email = await requireTeam();
  const all = await listEnquiries();
  const open = all.filter((e) => !e.handledAt);
  const done = all.filter((e) => e.handledAt);

  const card = (e: (typeof all)[number]) => (
    <article key={e.id} className={`tm-card tm-enquiry ${e.handledAt ? 'is-done' : ''}`}>
      <div className="tm-enquiry-head">
        <h2>{e.name}{e.company && <span className="tm-muted"> · {e.company}</span>}</h2>
        <span className="tm-muted tm-small">{when(e.createdAt)}</span>
      </div>
      <p className="tm-enquiry-meta">
        <a href={`mailto:${e.email}`}>{e.email}</a>
        {e.phone && <> · <a href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}>{e.phone}</a></>}
        {' · '}{INTEREST_LABEL[e.interest]}
        {' · '}prefers {e.contactBy === 'phone' ? 'a call' : 'email'}
      </p>
      {e.message && <p className="tm-enquiry-msg">{e.message}</p>}
      <div className="tm-lifecycle">
        <HandledButton id={e.id} handled={Boolean(e.handledAt)} />
        {e.handledAt && <span className="tm-muted tm-small">Followed up {when(e.handledAt)}{e.handledBy ? ` by ${e.handledBy}` : ''}</span>}
      </div>
    </article>
  );

  return (
    <TeamShell email={email} active="enquiries">
      <div className="tm-head"><h1>Enquiries</h1></div>
      <p className="tm-sub">People who left their details on the landing page to talk through their options before choosing a workshop.</p>
      {all.length === 0 && <p className="tm-empty">No enquiries yet.</p>}
      {open.length > 0 && (
        <>
          <h2 className="tm-h2">New ({open.length})</h2>
          <div className="tm-enquiries">{open.map(card)}</div>
        </>
      )}
      {done.length > 0 && (
        <>
          <h2 className="tm-h2">Followed up ({done.length})</h2>
          <div className="tm-enquiries">{done.map(card)}</div>
        </>
      )}
    </TeamShell>
  );
}
