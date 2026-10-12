import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalStore } from '@/lib/portal/store';
import { STATUS_LABEL, TIER_LABEL } from '@/lib/portal/types';
import { CalBooking } from './CalBooking';
import { CopyLink } from './CopyLink';
import { FilesStep } from './FilesStep';
import { IntakeForm } from './IntakeForm';

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
  const answered = Object.keys(w.answers ?? {}).length + new Set(allFiles.filter((f) => f.slideId).map((f) => f.slideId)).size;

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

        {welcome && (
          <div className="pt-note">
            {paid && <strong>Payment received, thank you. Your VAT invoice is on its way by email.</strong>}
            <strong>Keep this link.</strong> It&apos;s your private way back to this page, so bookmark it or save it somewhere
            safe. Anyone with the link can see and edit your answers.
            <CopyLink />
          </div>
        )}

        <ol className="pt-steps">
          <li className={w.intakeDone ? 'is-done' : 'is-current'}>
            <h2>1. Tell us about your brand</h2>
            <p>Ten minutes now saves time in the workshop. You can save and come back.</p>
            <IntakeForm token={token} intake={w.intake} done={w.intakeDone} />
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
                Once you&apos;ve finished step 1, you&apos;ll work through the workshop here at your own pace, typing or recording
                a voice note for each question.
              </p>
            ) : (
              <>
                <p>
                  {w.submittedAt
                    ? 'Thank you, your workshop is with our team. You can still review or change your answers.'
                    : 'Work through each question at your own pace, typing or recording a voice note. Everything saves as you go, so you can stop and come back.'}
                </p>
                <a className="pt-btn" href={`/start/${token}/workshop`}>
                  {w.submittedAt ? 'Review my answers' : answered ? 'Continue my workshop' : 'Start my workshop'}
                </a>
              </>
            )}
          </li>
        </ol>
      </div>
      <footer className="pt-foot">© Visions Design</footer>
    </main>
  );
}
