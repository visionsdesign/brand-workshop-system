import Link from 'next/link';
import { notFound } from 'next/navigation';
import { aboutTime, selfServeWorkshop, totalMinutes } from '@/lib/portal/selfserve';
import { CREDIT_LINE } from '@/lib/portal/payments';
import { portalStore } from '@/lib/portal/store';
import { VIVI_URL } from '@/lib/portal/vivi';
import { STATUS_LABEL, TIER_LABEL } from '@/lib/portal/types';
import { CalBooking } from './CalBooking';
import { CopyLink, KeepLink } from './CopyLink';
import { FilesStep } from './FilesStep';
import { IntakeStep } from './IntakeStep';
import { guideAvailable } from '@/lib/portal/guide';
import { voiceConfigured } from '@/lib/portal/voice';
import { ViviBubble } from '@/components/portal/ViviBubble';
import type { ReactNode } from 'react';

/** Once the workshop is finished, the steps fold away under a summary line */
function Steps({ folded, children }: { folded: boolean; children: ReactNode }) {
  if (!folded) return <>{children}</>;
  return (
    <details className="pt-shared">
      <summary>See what you shared with us</summary>
      {children}
    </details>
  );
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your Brand Workshop · Visions Design', robots: { index: false, follow: false } };

export default async function ClientPortal({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ welcome?: string; paid?: string }>;
}) {
  const { token } = await params;
  const { welcome, paid } = await searchParams;
  const store = portalStore();
  const w = await store.getByToken(token);
  if (!w) notFound();
  const allFiles = await store.listFiles(w.id);
  // Voice notes belong to the self-serve answers, not the shared files list
  const files = allFiles.filter((f) => !f.slideId);
  const guided = w.tier === 'guided';
  const filesDone = Boolean(w.intake.filesStep);
  const calLink = process.env.CALCOM_LINK ?? '';
  const booked = w.booking && w.booking.status !== 'cancelled';
  const when = w.booking?.start
    ? new Date(w.booking.start).toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short',
      })
    : '';
  // Finished: the team marked it complete (or archived it), or a self-serve client submitted
  const complete = w.status === 'complete' || Boolean(w.archivedAt);
  const submitted = !guided && Boolean(w.submittedAt) && !complete;
  const finished = complete || submitted;
  const finishedOn = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }) : '';
  const allowTime = aboutTime(totalMinutes(selfServeWorkshop(w).slides)).replace('about ', '');
  const answered = Object.keys(w.answers ?? {}).filter((k) => k !== 'INTAKE').length + new Set(allFiles.filter((f) => f.slideId).map((f) => f.slideId)).size;

  return (
    <main className="pt pt-portal">
      <header className="pt-bar pt-bar-solid">
        <span>Visions Design · Brand workshop</span>
        <span className="pt-pill">{TIER_LABEL[w.tier]} · {STATUS_LABEL[w.status]}</span>
      </header>

      <div className="pt-wrap">
        <h1 className="pt-title">{w.clientName}</h1>
        <p className="pt-lede">
          Hi {w.contactName.split(' ')[0]}. This is your workshop page. Everything you add here goes straight to our creative team.
        </p>

        {guided && booked && (
          <Link className="pt-booked-banner" href={`/start/${token}/booked`}>
            <span><strong>Your session is booked{when ? ` for ${when}` : ''}.</strong> See what happens next</span>
            <span aria-hidden>→</span>
          </Link>
        )}

        {finished && (
          <section className="pt-finished" aria-labelledby="finished-title">
            <span className="ss-complete-mark" aria-hidden>✓</span>
            <h2 id="finished-title">{complete ? 'Workshop complete' : 'Workshop submitted'}</h2>
            {complete ? (
              <p>
                Thank you, {w.contactName.split(' ')[0]}. We finished your workshop{w.completedAt ? ` on ${finishedOn(w.completedAt)}` : ''}.
                Your Brand DNA summary comes to you by email from our team. If it hasn&apos;t arrived, reply to any of our emails.
              </p>
            ) : (
              <>
                <p>Thank you. Your answers were sent on {finishedOn(w.submittedAt)} and are now with our creative team.</p>
                <ol className="ss-next">
                  <li>Our team reads every answer and AI conversation.</li>
                  <li>We may email you at {w.contactEmail} with a few follow-up questions.</li>
                  <li>We turn your answers into your Brand DNA summary and send it to you.</li>
                </ol>
              </>
            )}
            {complete && <p className="pt-finished-credit">{CREDIT_LINE}</p>}
            <div className="pt-actions pt-finished-actions">
              {!guided && (
                <a className="pt-btn" href={`/api/portal/answers/export?t=${encodeURIComponent(token)}`}>Download a copy of your answers</a>
              )}
              <a className="pt-btn pt-btn-ghost" href={VIVI_URL} target="_blank" rel="noreferrer">Talk to the team ↗</a>
            </div>
          </section>
        )}

        {finished ? null : welcome || !w.intakeDone ? (
          <KeepLink email={w.contactEmail} paid={Boolean(paid)} />
        ) : (
          <div className="pt-keeplink-mini">
            <span>Your private link is the way back to this page.</span>
            <CopyLink />
          </div>
        )}

        <Steps folded={finished}>
        <ol className="pt-steps">
          <li className={w.intakeDone ? 'is-done' : 'is-current'}>
            <h2>1. Tell us about your brand</h2>
            <p>A few minutes now saves time in the workshop. Chat with us, or fill in the form. You can save and come back.</p>
            <IntakeStep
              token={token}
              intake={w.intake}
              done={w.intakeDone}
              ai={guideAvailable() && !finished}
              voice={voiceConfigured()}
              chat={w.answers?.INTAKE?.chat ?? []}
            />
          </li>

          <li className={filesDone ? 'is-done' : w.intakeDone ? 'is-current' : ''}>
            <h2>2. Share anything useful</h2>
            <p>Brand guidelines, briefs, pitch decks, screenshots of your website or app. Optional, but it helps.</p>
            <FilesStep token={token} workshopId={w.id} files={files} status={w.intake.filesStep} canContinue={w.intakeDone} />
          </li>

          <li className={!w.intakeDone ? 'is-locked' : guided && booked ? 'is-done' : filesDone ? 'is-current' : ''}>
            <h2>3. {guided ? 'Book your session' : 'Start your workshop'}</h2>
            {guided ? (
              booked ? (
                <div className="pt-booked">
                  <p>
                    <strong>Your session is booked{when ? ` for ${when}` : ''}.</strong> We&apos;ve emailed the details and a
                    video link to {w.contactEmail}.
                    {w.booking?.status === 'pending' && ' Confirmation can take a minute to arrive.'}
                  </p>
                  <p><Link href={`/start/${token}/booked`}>See your booking summary and what happens next →</Link></p>
                  {w.booking?.uid && (
                    <p className="pt-hint">
                      Need to change it? <a href={`https://cal.com/reschedule/${w.booking.uid}`} target="_blank" rel="noreferrer">Reschedule</a> or{' '}
                      <a href={`https://cal.com/booking/${w.booking.uid}?cancel=true`} target="_blank" rel="noreferrer">cancel</a>.
                    </p>
                  )}
                </div>
              ) : !w.intakeDone ? (
                <p>Once you&apos;ve finished step 1, you&apos;ll be able to book your two-hour session with our team here.</p>
              ) : !filesDone ? (
                <p>Finish or skip step 2, then pick a time for your two-hour session here.</p>
              ) : calLink ? (
                <>
                  <p>Pick a time that suits you. Your session runs on a video call, and we&apos;ll prepare using what you&apos;ve shared above.</p>
                  <CalBooking token={token} workshopId={w.id} calLink={calLink} name={w.contactName} email={w.contactEmail} />
                </>
              ) : (
                <p>Thank you. Our team will be in touch at {w.contactEmail} to arrange your two-hour session.</p>
              )
            ) : !w.intakeDone ? (
              <p>
                Once you&apos;ve finished step 1, you&apos;ll work through the workshop here at your own pace, typing each
                answer or talking it through with our AI facilitator. Allow at least {allowTime} in total; it doesn&apos;t
                have to be in one sitting.
              </p>
            ) : (
              <>
                <p>
                  {w.submittedAt
                    ? 'Thank you, your workshop is with our team. You can still review or change your answers.'
                    : `Work through each question at your own pace, typing your answer or talking it through with our AI facilitator. Allow at least ${allowTime} in total. Everything saves as you go, so you can stop and come back.`}
                </p>
                <a className="pt-btn" href={`/start/${token}/workshop`}>
                  {w.submittedAt ? 'Review my answers' : answered ? 'Continue where I left off' : 'Start my workshop'}
                </a>
              </>
            )}
          </li>
        </ol>
        </Steps>
      </div>
      <footer className="pt-foot">© Visions Design</footer>
      <ViviBubble />
    </main>
  );
}
