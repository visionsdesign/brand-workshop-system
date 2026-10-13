import Link from 'next/link';
import { listRepoWorkshops } from '@/lib/content';
import { portalStore } from '@/lib/portal/store';
import { requireTeam } from '@/lib/portal/team';
import { STATUS_LABEL, TIER_LABEL } from '@/lib/portal/types';
import { TeamShell } from './TeamShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workshops · Visions team' };

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function TeamHome({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const email = await requireTeam();
  const showArchived = (await searchParams).archived === '1';
  const all = await portalStore().listWorkshops();
  const archivedCount = all.filter((w) => w.archivedAt).length;
  const workshops = all.filter((w) => Boolean(w.archivedAt) === showArchived);
  const repo = listRepoWorkshops();

  return (
    <TeamShell email={email} active="workshops">
      <div className="tm-head">
        <h1>Workshops</h1>
        <Link className="btn btn-primary" href="/team/codes">New code</Link>
      </div>
      <nav className="tm-tabs">
        <Link className={showArchived ? '' : 'is-active'} href="/team">Active ({all.length - archivedCount})</Link>
        <Link className={showArchived ? 'is-active' : ''} href="/team?archived=1">Archived ({archivedCount})</Link>
      </nav>

      {workshops.length === 0 ? (
        <p className="tm-empty">
          {showArchived ? 'No archived workshops.' : 'No client workshops yet. Create a code and send it to a client to get started.'}
        </p>
      ) : (
        <table className="tm-table">
          <thead>
            <tr><th>Client</th><th>Type</th><th>Status</th><th>Contact</th><th>Started</th></tr>
          </thead>
          <tbody>
            {workshops.map((w) => (
              <tr key={w.id}>
                <td><Link href={`/team/w/${w.id}`}>{w.clientName}</Link></td>
                <td>{TIER_LABEL[w.tier]}</td>
                <td><span className={`tm-status s-${w.status}`}>{STATUS_LABEL[w.status]}</span></td>
                <td>{w.contactName}<br /><small>{w.contactEmail}</small></td>
                <td>{date(w.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!showArchived && repo.length > 0 && (
        <>
          <h2 className="tm-h2">Prepared in the repo</h2>
          <p className="tm-sub">Facilitated workshops set up through client.md and facilitator-notes.md.</p>
          <table className="tm-table">
            <thead><tr><th>Client</th><th>Date</th><th>Links</th></tr></thead>
            <tbody>
              {repo.map((r) => (
                <tr key={r.slug}>
                  <td>{r.clientName}</td>
                  <td>{r.date}</td>
                  <td>
                    <a href={`/w/${r.code}/present`}>Facilitator view</a> · <a href={`/w/${r.code}`} target="_blank" rel="noreferrer">Client view ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </TeamShell>
  );
}
