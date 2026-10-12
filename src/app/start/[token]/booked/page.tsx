import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sessionWhen } from '@/lib/portal/format';
import { INTAKE_FIELDS } from '@/lib/portal/intake';
import { CREDIT_LINE } from '@/lib/portal/payments';
import { portalStore } from '@/lib/portal/store';
import { AwaitConfirmation } from './AwaitConfirmation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'You’re booked · Visions Design', robots: { index: false, follow: false } };

/** Where a guided client lands after booking: their session, what happens next, and what they've shared */
export default async function Booked({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = portalStore();
  const w = await store.getByToken(token);
  if (!w) notFound();
  if (w.tier !== 'guided' || !w.booking || w.booking.status === 'cancelled') redirect(`/start/${token}`);

  const files = (await store.listFiles(w.id)).filter((f) => !f.slideId);
  const when = sessionWhen(w.booking);
  const answered = INTAKE_FIELDS.filter((f) => w.intake[f.key]?.trim()).length;
  const first = w.contactName.split(' ')[0];
  const uid = w.booking.uid;

  return (
    <main className="pt pt-portal">
      {!when && <AwaitConfirmation />}
      <header className="pt-bar pt-bar-solid">
        <span>Visions Design · Brand workshop</span>
        <span className="pt-pill">Guided workshop · Booked</span>
      </header>

      <div className="pt-wrap pt-booked-page">
        <p className="pt-eyebrow">{w.clientName}</p>
        <h1 className="pt-title">You&apos;re booked{first ? `, ${first}` : ''}.</h1>

        <section className="pt-session">
          {when ? (
            <>
              <p className="pt-session-date">{when.date}</p>
              <p className="pt-session-time">{when.time}</p>
            </>
          ) : (
            <p className="pt-session-time">Confirming your time with our calendar…</p>
          )}
          <p className="pt-session-meta">Two hours on a video call with the Visions creative team.</p>
          <p className="pt-hint">
            Your calendar invite and video link are on their way to {w.contactEmail}.
            {uid && (
              <>
                {' '}Need to change it?{' '}
                <a href={`https://cal.com/reschedule/${uid}`} target="_blank" rel="noreferrer">Reschedule</a> or{' '}
                <a href={`https://cal.com/booking/${uid}?cancel=true`} target="_blank" rel="noreferrer">cancel</a>.
              </>
            )}
          </p>
        </section>

        <section>
          <h2 className="pt-h2">What happens next</h2>
          <ol className="pt-timeline">
            <li>
              <h3>Now</h3>
              <p>
                Our team has your answers{files.length ? ` and ${files.length} file${files.length === 1 ? '' : 's'}` : ''}. You can
                add anything else up to the day of the session: new thoughts, files, links.
              </p>
            </li>
            <li>
              <h3>Before your session</h3>
              <p>
                We read everything you&apos;ve shared, look at your brand and your market, and prepare questions specific to you,
                so the two hours go on the things that matter most.
              </p>
            </li>
            <li>
              <h3>The session</h3>
              <p>
                We work through your story, your audience and your voice together. Join from somewhere quiet, and bring
                whoever has the final say on the brand. There&apos;s no homework: just come ready to talk.
              </p>
            </li>
            <li>
              <h3>Afterwards</h3>
              <p>
                We turn the session into your Brand DNA summary: the clear, agreed foundation every piece of your brand is
                built on. We&apos;ll send it to you to review.
              </p>
            </li>
          </ol>
          <p className="pt-credit pt-credit-left">{CREDIT_LINE}</p>
        </section>

        <section className="pt-shared">
          <h2 className="pt-h2">What you&apos;ve shared</h2>
          <ul>
            <li>
              <span>About your brand</span>
              <span>{answered} of {INTAKE_FIELDS.length} questions answered</span>
            </li>
            <li>
              <span>Files</span>
              <span>{files.length ? files.map((f) => f.name).join(', ') : 'None yet'}</span>
            </li>
          </ul>
          <Link className="pt-btn pt-btn-ghost" href={`/start/${token}`}>Add or change anything</Link>
        </section>
      </div>
      <footer className="pt-foot">© Visions Design</footer>
    </main>
  );
}
