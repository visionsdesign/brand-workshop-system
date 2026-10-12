import { portalStore } from '@/lib/portal/store';
import { requireTeam } from '@/lib/portal/team';
import { TIER_LABEL } from '@/lib/portal/types';
import { TeamShell } from '../TeamShell';
import { CodeForm } from './CodeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Codes · Visions team' };

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function Codes() {
  const email = await requireTeam();
  const codes = await portalStore().listCodes();
  return (
    <TeamShell email={email} active="codes">
      <div className="tm-head"><h1>Workshop codes</h1></div>
      <p className="tm-sub">
        Send a code to a client who has paid by invoice. They enter it on the workshop home page with their details.
      </p>
      <CodeForm />

      <table className="tm-table">
        <thead><tr><th>Code</th><th>Type</th><th>For</th><th>Used</th><th>Expires</th><th>Created</th></tr></thead>
        <tbody>
          {codes.map((c) => {
            const expired = c.expiresAt && Date.parse(c.expiresAt) < Date.now();
            return (
              <tr key={c.code} className={c.uses >= c.maxUses || expired ? 'is-spent' : ''}>
                <td><code>{c.code}</code></td>
                <td>{TIER_LABEL[c.tier]}</td>
                <td>{c.label || '—'}</td>
                <td>{c.uses} / {c.maxUses}</td>
                <td>{c.expiresAt ? (expired ? 'Expired' : date(c.expiresAt)) : 'Never'}</td>
                <td>{date(c.createdAt)}<br /><small>{c.createdBy}</small></td>
              </tr>
            );
          })}
          {codes.length === 0 && <tr><td colSpan={6} className="tm-empty">No codes yet.</td></tr>}
        </tbody>
      </table>
    </TeamShell>
  );
}
