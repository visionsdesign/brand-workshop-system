'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aboutTime, HINTS, isAnswered, minutesFor, partsFor, slideAnswersView, totalMinutes } from '@/lib/portal/selfserve-client';
import type { SelfServeAnswers, SlideAnswer, WorkshopFile } from '@/lib/portal/types';
import type { Workshop, WorkshopSlide } from '@/lib/types';
import { Slide } from '../Slide';
import { SlideFrame } from '../SlideFrame';
import { GuideChat } from './GuideChat';

interface Props {
  token: string;
  workshopId: string;
  workshop: Workshop;
  initialAnswers: SelfServeAnswers;
  initialNotes: WorkshopFile[];
  contactEmail: string;
  submitted: boolean;
  closed: boolean;
  /** The AI facilitator is switched on (server has a Claude API key) */
  aiEnabled: boolean;
  /** ElevenLabs is configured: questions can be read aloud, the facilitator can speak */
  voiceEnabled: boolean;
  submit: () => Promise<void>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The client works through the workshop alone: one slide at a time, typed or spoken answers, autosaved. */
export function SelfServe({ token, workshopId, workshop, initialAnswers, initialNotes, contactEmail, submitted, closed, aiEnabled, voiceEnabled, submit }: Props) {
  const slides = workshop.slides;
  const [answers, setAnswers] = useState(initialAnswers);
  const [notes] = useState(initialNotes); // older voice notes still count towards answered questions
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [isSubmitted, setSubmitted] = useState(submitted);
  const [submitting, setSubmitting] = useState(false);
  // Bumped when a drafted answer is applied, to refresh the (uncontrolled) answer boxes
  const [formVersion, setFormVersion] = useState(0);
  const pending = useRef<Record<string, SlideAnswer>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const storeKey = `ss-pos-${workshopId}`;

  // Resume where they left off: the question they were on (this device), else the first unanswered one
  const [welcomeBack, setWelcomeBack] = useState(false);
  useEffect(() => {
    let start = slides.findIndex((s) => !isAnswered(s, initialAnswers[s.id], initialNotes.filter((n) => n.slideId === s.id).length));
    try {
      const saved = Number(localStorage.getItem(storeKey));
      if (localStorage.getItem(storeKey) !== null && Number.isInteger(saved) && saved >= 0 && saved < slides.length) start = saved;
    } catch { /* storage unavailable */ }
    setIndex(Math.max(0, start));
    // A finished workshop opens on its completion screen
    if (submitted || closed) setReview(true);
    setWelcomeBack(!submitted && !closed && slides.some((s) => isAnswered(s, initialAnswers[s.id], initialNotes.filter((n) => n.slideId === s.id).length)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(storeKey, String(index)); } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [index, storeKey]);

  const flush = useCallback(async (slideId: string) => {
    const patch = pending.current[slideId];
    if (!patch) return;
    delete pending.current[slideId];
    setSave('saving');
    const r = await fetch('/api/portal/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workshop-token': token },
      body: JSON.stringify({ slideId, ...patch }),
    }).catch(() => null);
    setSave(r?.ok ? 'saved' : 'error');
  }, [token]);

  /** Update locally at once; save after a short pause in typing (or straight away for taps) */
  const update = useCallback((slideId: string, patch: SlideAnswer, immediate = false) => {
    setAnswers((prev) => {
      const old = prev[slideId] ?? {};
      return {
        ...prev,
        [slideId]: {
          ...old,
          ...patch,
          parts: patch.parts ? { ...old.parts, ...patch.parts } : old.parts,
          values: patch.values ? { ...old.values, ...patch.values } : old.values,
        },
      };
    });
    const queued = pending.current[slideId] ?? {};
    pending.current[slideId] = {
      ...queued,
      ...patch,
      parts: patch.parts ? { ...queued.parts, ...patch.parts } : queued.parts,
      values: patch.values ? { ...queued.values, ...patch.values } : queued.values,
    };
    clearTimeout(timers.current[slideId]);
    setSave('saving');
    timers.current[slideId] = setTimeout(() => flush(slideId), immediate ? 0 : 800);
  }, [flush]);

  // Save anything still waiting before the page closes
  useEffect(() => {
    const onHide = () => {
      for (const [slideId, patch] of Object.entries(pending.current)) {
        fetch('/api/portal/answers', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', 'x-workshop-token': token },
          body: JSON.stringify({ slideId, ...patch }),
        });
      }
      pending.current = {};
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [token]);

  const go = (i: number) => {
    const current = slides[index];
    if (current) {
      clearTimeout(timers.current[current.id]);
      flush(current.id);
    }
    setReview(false);
    setWelcomeBack(false);
    setIndex(Math.min(slides.length - 1, Math.max(0, i)));
  };

  const answeredFlags = useMemo(
    () => slides.map((s) => isAnswered(s, answers[s.id], notes.filter((n) => n.slideId === s.id).length)),
    [slides, answers, notes],
  );
  const answeredCount = answeredFlags.filter(Boolean).length;
  const firstOpen = answeredFlags.findIndex((a) => !a);
  const percent = Math.round((answeredCount / slides.length) * 100);
  const minutesLeft = totalMinutes(slides.filter((_, i) => !answeredFlags[i]));
  // The sidebar, grouped by workshop section, each with its own count
  const sections = useMemo(() => {
    const groups: { name: string; items: number[] }[] = [];
    slides.forEach((s, i) => {
      const last = groups.at(-1);
      if (last && last.name === s.section) last.items.push(i);
      else groups.push({ name: s.section || 'Wrap-Up', items: [i] });
    });
    return groups;
  }, [slides]);
  const slide = slides[index];
  const locked = closed || isSubmitted;

  return (
    <div className="ss">
      <header className="ss-top">
        <Link href={`/start/${token}`} className="ss-back">← Workshop page</Link>
        <div className="ss-progress" role="progressbar" aria-valuemin={0} aria-valuemax={slides.length} aria-valuenow={answeredCount} aria-label="Questions answered">
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="ss-count"><strong>{answeredCount} of {slides.length}</strong> answered · {percent}%{minutesLeft && !locked ? ` · ${aboutTime(minutesLeft)} left` : ''}</span>
        <span className={`ss-save s-${save}`}>
          {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : save === 'error' ? 'Not saved, check your connection' : ''}
        </span>
      </header>

      <div className="ss-body">
        <nav className="ss-list" aria-label="Questions">
          {sections.map((g) => (
            <div key={g.name} className="ss-group">
              <p className="ss-group-head">
                <span>{g.name}</span>
                <span>{g.items.filter((i) => answeredFlags[i]).length}/{g.items.length}</span>
              </p>
              {g.items.map((i) => {
                const s = slides[i];
                return (
                  <button
                    key={s.id}
                    className={`ss-item ${!review && i === index ? 'is-current' : ''} ${answeredFlags[i] ? 'is-done' : ''}`}
                    onClick={() => go(i)}
                    aria-current={!review && i === index ? 'step' : undefined}
                  >
                    <span className="ss-tick" aria-label={answeredFlags[i] ? 'Answered' : `Question ${i + 1}`}>{answeredFlags[i] ? '✓' : i + 1}</span>
                    <span>{s.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <button className={`ss-item ss-item-review ${review ? 'is-current' : ''}`} onClick={() => setReview(true)}>
            <span className="ss-tick" aria-hidden>→</span>
            <span>Review and submit</span>
          </button>
        </nav>

        <main className="ss-main">
          {review ? (
            <Review
              token={token}
              email={contactEmail}
              slides={slides}
              answered={answeredFlags}
              submitted={isSubmitted}
              closed={closed}
              submitting={submitting}
              onGo={go}
              onSubmit={async () => {
                if (!window.confirm('Submit your workshop to Visions? Your answers will be locked and sent to our team.')) return;
                setSubmitting(true);
                for (const id of Object.keys(pending.current)) await flush(id);
                await submit();
                setSubmitted(true);
                setSubmitting(false);
              }}
            />
          ) : (
            <>
              {welcomeBack && (
                <div className="ss-welcome" role="status">
                  <p>
                    <strong>Welcome back.</strong> You&apos;ve answered {answeredCount} of {slides.length} questions. You&apos;re on
                    question {index + 1}: {slide.title}.
                  </p>
                  {firstOpen >= 0 && firstOpen !== index && (
                    <button type="button" className="pt-btn pt-btn-sm" onClick={() => go(firstOpen)}>
                      Go to the first unanswered (question {firstOpen + 1})
                    </button>
                  )}
                </div>
              )}
              <div className="ss-step-row">
                <p className="ss-step">Question {index + 1} of {slides.length} · {slide.section} · about {minutesFor(slide)} min</p>
                {voiceEnabled && <QuestionVoice key={slide.id} token={token} slideId={slide.id} />}
              </div>
              <div className="ss-slide">
                <SlideFrame>
                  <Slide
                    slide={slide}
                    ctx={workshop}
                    answers={slideAnswersView(slide, answers[slide.id])}
                    onAnswer={
                      !locked && (slide.kind === 'scales' || slide.kind === 'choices')
                        ? (key, value) => update(slide.id, { values: { [key]: value as number | null } }, true)
                        : undefined
                    }
                  />
                </SlideFrame>
              </div>

              <AnswerPanel
                key={`${slide.id}-${formVersion}`}
                slide={slide}
                answer={answers[slide.id]}
                locked={locked}
                onChange={(patch, immediate) => update(slide.id, patch, immediate)}
              />

              {aiEnabled && (
                <GuideChat
                  key={slide.id}
                  token={token}
                  slideId={slide.id}
                  initial={answers[slide.id]?.chat ?? []}
                  partLabels={partsFor(slide).map((p) => p.key)}
                  disabled={locked}
                  voice={voiceEnabled}
                  onUseDraft={(d) => {
                    update(slide.id, { text: d.text, parts: Object.keys(d.parts).length ? d.parts : undefined }, true);
                    setFormVersion((v) => v + 1);
                  }}
                />
              )}

              <div className="ss-nav">
                <button className="pt-btn pt-btn-ghost" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
                {index < slides.length - 1 ? (
                  <button className="pt-btn" onClick={() => go(index + 1)}>Next</button>
                ) : (
                  <button className="pt-btn" onClick={() => { flush(slide.id); setReview(true); }}>Review and submit</button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function AnswerPanel({ slide, answer, locked, onChange }: { slide: WorkshopSlide; answer?: SlideAnswer; locked: boolean; onChange: (p: SlideAnswer, immediate?: boolean) => void }) {
  const parts = partsFor(slide);
  const tapped = slide.kind === 'scales' || slide.kind === 'choices';
  const hint = HINTS[slide.id];
  return (
    <div className="ss-answer">
      {hint && <p className="ss-hint">{hint}</p>}
      {slide.scales && (
        <div className="ss-scales">
          {slide.scales.map(([l, r], i) => {
            const key = `${slide.id}.scale.${i}`;
            const v = answer?.values?.[key];
            return (
              <div className="ss-scale" key={l} role="radiogroup" aria-label={`${l} to ${r}`}>
                <span className="ss-scale-l">{l}</span>
                <div className="ss-scale-pts">
                  {Array.from({ length: 10 }, (_, k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={v === k + 1}
                      aria-label={`${k + 1} of 10`}
                      className={v === k + 1 ? 'is-on' : ''}
                      disabled={locked}
                      onClick={() => onChange({ values: { [key]: v === k + 1 ? null : k + 1 } }, true)}
                    />
                  ))}
                </div>
                <span className="ss-scale-r">{r}</span>
              </div>
            );
          })}
        </div>
      )}
      {slide.groups && (
        <div className="ss-groups">
          {slide.groups.map((g, i) => {
            const key = `${slide.id}.q${i}`;
            const v = answer?.values?.[key];
            return (
              <fieldset key={g.q} className="ss-group">
                <legend>{g.q}</legend>
                {g.options.map((o, oi) => (
                  <button
                    key={o}
                    type="button"
                    className={`ss-opt ${v === oi ? 'is-on' : ''}`}
                    aria-pressed={v === oi}
                    disabled={locked}
                    onClick={() => onChange({ values: { [key]: v === oi ? null : oi } }, true)}
                  >
                    <span className="s-radio" />
                    {o}
                  </button>
                ))}
              </fieldset>
            );
          })}
        </div>
      )}
      {parts.map((p) => (
        <label key={p.key}>
          <span>{p.label}</span>
          {p.prompt && <small>{p.prompt}</small>}
          <textarea
            rows={3}
            disabled={locked}
            defaultValue={answer?.parts?.[p.key] ?? ''}
            key={`${slide.id}-${p.key}`}
            onChange={(e) => onChange({ parts: { [p.key]: e.target.value } })}
          />
        </label>
      ))}
      <label>
        <span>{parts.length || tapped ? 'Anything to add? (optional)' : 'Your answer'}</span>
        <textarea
          rows={parts.length || tapped ? 3 : 6}
          disabled={locked}
          placeholder={parts.length || tapped ? '' : 'Type your answer here, or talk it through with the AI facilitator below.'}
          defaultValue={answer?.text ?? ''}
          key={`${slide.id}-text`}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </label>
    </div>
  );
}

function Review({
  token, email, slides, answered, submitted, closed, submitting, onGo, onSubmit,
}: {
  token: string; email: string;
  slides: WorkshopSlide[]; answered: boolean[]; submitted: boolean; closed: boolean; submitting: boolean;
  onGo: (i: number) => void; onSubmit: () => void;
}) {
  const missing = slides.map((s, i) => ({ s, i })).filter(({ i }) => !answered[i]);
  if (submitted || closed) {
    return (
      <div className="ss-review ss-complete">
        <span className="ss-complete-mark" aria-hidden>✓</span>
        <h1>Workshop submitted</h1>
        <p>
          Thank you. You answered {slides.length - missing.length} of {slides.length} questions, and everything is now with our
          creative team.
        </p>
        <h2>What happens next</h2>
        <ol className="ss-next">
          <li>Our team reads every answer and AI conversation.</li>
          <li>We may email you at {email} with a few follow-up questions.</li>
          <li>We turn your answers into your Brand DNA summary and send it to you.</li>
        </ol>
        <p className="ss-locked-note">Your answers are now locked. If you need to change something, reply to our email and we can reopen it.</p>
        <div className="pt-actions ss-complete-actions">
          <a className="pt-btn" href={`/api/portal/answers/export?t=${encodeURIComponent(token)}`}>Download a copy of your answers</a>
          <a className="pt-btn pt-btn-ghost" href={`/start/${token}`}>Back to your workshop page</a>
        </div>
      </div>
    );
  }
  return (
    <div className="ss-review">
      <h1>Review and submit</h1>
      {missing.length ? (
        <>
          <p>You&apos;ve answered {slides.length - missing.length} of {slides.length} questions. You can submit now, or go back to these:</p>
          <ul>{missing.map(({ s, i }) => <li key={s.id}><button className="pt-link" onClick={() => onGo(i)}>{i + 1}. {s.title}</button></li>)}</ul>
        </>
      ) : (
        <p>Every question has an answer. Submit when you&apos;re ready.</p>
      )}
      <p className="ss-locked-note">Once you submit, your answers are locked and go to our team.</p>
      <button className="pt-btn" onClick={onSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit to Visions'}</button>
    </div>
  );
}

const MUTED_KEY = 'ss-voice-muted';

/**
 * Reads each question aloud in the workshop voice as soon as it opens, unless
 * the client has muted it (remembered on this device). The audio is generated
 * once per question and cached. If the browser blocks autoplay, the button
 * falls back to a play control.
 */
function QuestionVoice({ token, slideId }: { token: string; slideId: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [muted, setMuted] = useState<boolean | null>(null);

  function play() {
    audio.current ??= new Audio(`/api/portal/speak/question?slideId=${slideId}&t=${encodeURIComponent(token)}`);
    const a = audio.current;
    a.onplaying = () => setState('playing');
    a.onended = a.onerror = () => setState('idle');
    setState('loading');
    a.currentTime = 0;
    a.play().catch(() => setState('idle'));
  }
  function stop() {
    audio.current?.pause();
    setState('idle');
  }

  // Read the saved preference, then speak the question unless muted
  useEffect(() => {
    let m = false;
    try { m = localStorage.getItem(MUTED_KEY) === '1'; } catch { /* ignore */ }
    setMuted(m);
    if (!m) play();
    return () => audio.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(MUTED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    if (next) stop();
    else play();
  }

  if (muted === null) return null;
  return (
    <div className="ss-voice">
      <button type="button" className={`ss-listen ${state !== 'idle' ? 'is-on' : ''}`} onClick={state === 'idle' ? play : stop}>
        {state === 'loading' ? 'Loading…' : state === 'playing' ? '■ Stop' : muted ? '▶ Play the question' : '▶ Play again'}
      </button>
      <button type="button" className={`ss-listen ${muted ? 'is-on' : ''}`} onClick={toggleMute} aria-pressed={muted}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  );
}
