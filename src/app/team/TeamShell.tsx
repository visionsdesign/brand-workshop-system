import Link from 'next/link';
import type { ReactNode } from 'react';
import { usingSupabase } from '@/lib/portal/store';
import { logout } from './actions';

export function TeamShell({ email, active, children }: { email: string; active: 'workshops' | 'codes' | 'enquiries' | 'vivi'; children: ReactNode }) {
  return (
    <div className="tm">
      <header className="tm-bar">
        <strong>Visions · Brand workshops</strong>
        <nav>
          <Link className={active === 'workshops' ? 'is-active' : ''} href="/team">Workshops</Link>
          <Link className={active === 'codes' ? 'is-active' : ''} href="/team/codes">Codes</Link>
          <Link className={active === 'enquiries' ? 'is-active' : ''} href="/team/enquiries">Enquiries</Link>
          <Link className={active === 'vivi' ? 'is-active' : ''} href="/team/vivi">ViVi</Link>
        </nav>
        <span className="tm-who">{email}</span>
        <form action={logout}>
          <button className="btn">Sign out</button>
        </form>
      </header>
      {!usingSupabase() && (
        <p className="tm-local">
          Running locally: workshops, codes and uploads are saved in this computer&apos;s .data folder, not online.
        </p>
      )}
      <main className="tm-main">{children}</main>
    </div>
  );
}
