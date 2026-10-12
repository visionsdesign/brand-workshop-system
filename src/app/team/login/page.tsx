import { redirect } from 'next/navigation';
import { usingSupabase } from '@/lib/portal/store';
import { teamDomain, teamMember } from '@/lib/portal/team';
import { LoginForms } from './LoginForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team sign in · Brand Workshop' };

export default async function TeamLogin() {
  if (await teamMember()) redirect('/team');
  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Visions team</h1>
        <p>Sign in to see every workshop, the client files and the session notes.</p>
        <LoginForms
          mode={usingSupabase() ? 'email' : 'pin'}
          domain={teamDomain()}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
          anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}
        />
      </div>
    </main>
  );
}
