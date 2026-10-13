import Link from 'next/link';
import { portalStore } from '@/lib/portal/store';
import { requireTeam } from '@/lib/portal/team';
import { listConversations } from '@/lib/portal/vivi-log';
import { VIVI_FAQ } from '@/lib/portal/vivi';
import { TeamShell } from '../TeamShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ViVi conversations · Visions team' };

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const SAMPLES = new Set(VIVI_FAQ.map((f) => f.q));

/** Every ViVi conversation from the public pages, newest first */
export default async function ViviConversations() {
  const email = await requireTeam();
  const [conversations, workshops] = await Promise.all([listConversations(), portalStore().listWorkshops()]);
  const clientName = new Map(workshops.map((w) => [w.id, w.clientName]));

  // The questions visitors typed themselves (not the sample ones), most recent first
  const asked = conversations
    .flatMap((c) => c.turns.filter((t) => t.role === 'user' && !SAMPLES.has(t.content)).map((t) => ({ q: t.content, at: c.updatedAt })))
    .slice(0, 12);

  return (
    <TeamShell email={email} active="vivi">
      <div className="tm-head"><h1>ViVi conversations</h1></div>
      <p className="tm-sub">
        What visitors ask ViVi on the workshop pages. Visitors are anonymous unless the chat happened on a client&apos;s own workshop page.
      </p>

      {asked.length > 0 && (
        <section className="tm-card tm-vivi-asked">
          <h2>Recently asked</h2>
          <ul>{asked.map((a, i) => <li key={i}>{a.q}</li>)}</ul>
        </section>
      )}

      {conversations.length === 0 ? (
        <p className="tm-empty">No conversations yet.</p>
      ) : (
        <div className="tm-vivi-list">
          {conversations.map((c) => {
            const first = c.turns.find((t) => t.role === 'user')?.content ?? '';
            return (
              <details key={c.id} className="tm-card tm-vivi">
                <summary>
                  <span className="tm-vivi-q">{first}</span>
                  <span className="tm-muted">
                    {c.page}
                    {c.workshopId && clientName.get(c.workshopId) ? (
                      <> · <Link href={`/team/w/${c.workshopId}`}>{clientName.get(c.workshopId)}</Link></>
                    ) : null}
                    {' · '}{c.messageCount} messages · {when(c.updatedAt)}
                  </span>
                </summary>
                <div className="tm-vivi-turns">
                  {c.turns.map((t, i) => (
                    <p key={i} className={t.role === 'user' ? 'is-user' : ''}>
                      <span className="who">{t.role === 'user' ? 'Visitor' : 'ViVi'}</span>
                      {t.content}
                    </p>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </TeamShell>
  );
}
