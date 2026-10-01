'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSession } from '@/lib/sync';
import { hms } from '@/lib/timeline';
import type { SessionState, SlideStatus, TimelineEvent, Workshop, WorkshopNotes, WorkshopSlide } from '@/lib/types';
import { plain } from './Rich';
import { Slide } from './Slide';
import { SlideFrame } from './SlideFrame';

interface Props {
  workshop: Workshop;
  notes: WorkshopNotes;
  initial: SessionState;
  initialEvents: TimelineEvent[];
}

const NEXT_STATUS: Record<SlideStatus, SlideStatus> = { include: 'light', light: 'skip', skip: 'include' };
const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function PresenterView({ workshop: w, notes, initial, initialEvents }: Props) {
  const { state, act, connection } = useSession(w.code, initial);
  const [tab, setTab] = useState<'notes' | 'brief'>('notes');
  const [toast, setToast] = useState('');
  // 0 until mounted so the server render and hydration agree; timers clamp at zero
  const [now, setNow] = useState(0);
  const [events, setEvents] = useState(initialEvents.filter((e) => e.kind === 'slide'));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusOf = useCallback((s: WorkshopSlide) => state.overrides[s.id] ?? s.status, [state.overrides]);
  const index = Math.max(0, w.slides.findIndex((s) => s.id === state.current));
  const slide = w.slides[index];
  const live = w.slides.filter((s) => statusOf(s) !== 'skip');
  const findLive = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < w.slides.length; i += dir) {
      if (statusOf(w.slides[i]) !== 'skip') return w.slides[i];
    }
    return null;
  };
  const next = findLive(index, 1);
  const prev = findLive(index, -1);

  // Keep a local copy of slide changes for the timers
  useEffect(() => {
    if (!state.current) return;
    setEvents((ev) =>
      ev.at(-1)?.slideId === state.current ? ev : [...ev, { kind: 'slide', slideId: state.current, at: new Date().toISOString() }],
    );
  }, [state.current]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const go = useCallback((s: WorkshopSlide | null) => s && act({ type: 'slide', slideId: s.id }), [act]);

  const flag = useCallback(() => {
    act({ type: 'marker', slideId: slide.id });
    const t0 = state.recordingStartedAt ? Date.parse(state.recordingStartedAt) : null;
    flash(t0 ? `Moment flagged at ${hms(Date.now() - t0)}` : 'Moment flagged');
  }, [act, slide.id, state.recordingStartedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [role="slider"]')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(next); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(prev); }
      else if (e.key.toLowerCase() === 'm') flag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, next, prev, flag]);

  useEffect(() => {
    listRef.current?.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  // ----- timings -----
  const durations = useMemo(() => {
    const d = new Map<string, number>();
    events.forEach((e, i) => {
      const end = events[i + 1] ? Date.parse(events[i + 1].at) : now;
      if (e.slideId) d.set(e.slideId, (d.get(e.slideId) ?? 0) + end - Date.parse(e.at));
    });
    return d;
  }, [events, now]);
  const onSlide = durations.get(slide.id) ?? 0;
  const block = w.blocks.find((b) => b.name === slide.block);
  const blockSpent = block
    ? w.slides.filter((s) => s.block === block.name).reduce((sum, s) => sum + (durations.get(s.id) ?? 0), 0)
    : 0;
  const sessionStart = state.recordingStartedAt ? Date.parse(state.recordingStartedAt) : events[0] ? Date.parse(events[0].at) : null;
  const plannedTotal = w.blocks.reduce((a, b) => a + b.minutes, 0);

  const clientUrl = typeof window === 'undefined' ? `/w/${w.code}` : `${window.location.origin}/w/${w.code}`;
  const slideNotes = notes.slides[slide.id];
  const status = statusOf(slide);

  const cycleStatus = (s: WorkshopSlide) => {
    const to = NEXT_STATUS[statusOf(s)];
    act({ type: 'override', slideId: s.id, status: to === s.status ? null : to });
  };

  let lastSection = '';

  return (
    <div className="pv">
      <header className="pv-top">
        <div className="pv-brand">
          <strong>{w.clientName} · Brand DNA Workshop</strong>
          <span>{[w.date, w.attendees.join(', ')].filter(Boolean).join(' · ')}</span>
        </div>
        <span className="pv-conn">
          <span className={`dot ${connection === 'live' ? 'live' : connection}`} />
          {connection === 'live' ? 'Live' : connection === 'polling' ? 'Syncing (polling)' : connection === 'offline' ? 'Offline' : 'Connecting'}
        </span>
        <span className="pv-clock" title="Session time against the planned running order">
          {sessionStart ? hms(now - sessionStart) : '00:00:00'}
          {plannedTotal ? ` / ${plannedTotal}m` : ''}
        </span>
        <button
          className={`btn btn-rec ${state.recordingStartedAt ? 'is-on' : ''}`}
          onClick={() => act({ type: 'recording', start: !state.recordingStartedAt })}
          title="Press when the call recording starts, so the timeline matches the recording"
        >
          <span className={`dot ${state.recordingStartedAt ? 'rec' : ''}`} />
          {state.recordingStartedAt ? 'Recording clock on' : 'Start recording clock'}
        </button>
        <button
          className="btn"
          onClick={() => navigator.clipboard.writeText(clientUrl).then(() => flash('Client link copied'))}
        >
          Copy client link
        </button>
        <a className="btn" href={`/w/${w.code}`} target="_blank" rel="noreferrer">Client view ↗</a>
        <a className="btn" href={`/api/w/${w.code}/timeline`}>Download timeline</a>
      </header>

      <div className="pv-main">
        <nav className="pv-list" ref={listRef} aria-label="Slides">
          {w.slides.map((s) => {
            const st = statusOf(s);
            const header = s.section && s.section !== lastSection ? s.section : null;
            if (s.section) lastSection = s.section;
            return (
              <div key={s.id}>
                {header && <div className="pv-list-section">{header}</div>}
                <div
                  className={`pv-item ${s.id === slide.id ? 'is-current' : ''} ${st === 'skip' ? 'is-skip' : ''}`}
                  onClick={() => go(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && go(s)}
                >
                  <span className="pv-item-id">{s.id}</span>
                  <span className="pv-item-title" title={s.title}>{s.title}</span>
                  {s.kind === 'divider' || s.kind === 'title' ? (
                    <span />
                  ) : (
                    <button
                      className={`chip ${st}`}
                      title="Include / light / skip"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStatus(s);
                      }}
                    >
                      {st === 'include' ? (s.bespoke ? 'new' : '·') : st}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <section className="pv-stage">
          <SlideFrame>
            <Slide
              slide={slide}
              ctx={w}
              answers={state.answers}
              onAnswer={(key, value) => act({ type: 'answer', key, value })}
            />
          </SlideFrame>
          <div className="pv-controls">
            <button className="btn btn-lg" onClick={() => go(prev)} disabled={!prev}>← Back</button>
            <button className="btn btn-lg btn-primary" onClick={() => go(next)} disabled={!next}>Next →</button>
            <span className="pv-pos">
              {live.findIndex((s) => s.id === slide.id) + 1} of {live.length}
            </span>
            <span className="spacer" />
            <button className="btn" onClick={flag} title="Mark this moment in the timeline (M)">
              ★ Flag moment <kbd>M</kbd>
            </button>
          </div>
          {next && (
            <div className="pv-next">
              <div className="pv-next-thumb">
                <SlideFrame>
                  <Slide slide={next} ctx={w} answers={state.answers} />
                </SlideFrame>
              </div>
              <div>
                Up next
                <div className="pv-next-title">{next.id} · {next.title}</div>
              </div>
            </div>
          )}
        </section>

        <aside className="pv-notes">
          <div className="pv-tabs" role="tablist">
            <button className={`pv-tab ${tab === 'notes' ? 'is-active' : ''}`} onClick={() => setTab('notes')}>Slide notes</button>
            <button className={`pv-tab ${tab === 'brief' ? 'is-active' : ''}`} onClick={() => setTab('brief')}>Client brief</button>
          </div>

          <div className="pv-notes-body">
            {tab === 'notes' ? (
              <>
                <div className="pv-slide-head">
                  <div className="id">{slide.id} · {slide.section || 'Opening'}</div>
                  <h2>{slide.title}</h2>
                </div>

                <div className="pv-timing">
                  <div>
                    <span>This slide</span>
                    <strong className={slide.minutes && onSlide > slide.minutes * 60000 ? 'over' : ''}>
                      {mmss(onSlide)}{slide.minutes ? ` / ${Math.round(slide.minutes)}m` : ''}
                    </strong>
                  </div>
                  <div>
                    <span>{block ? block.name : 'Block'}</span>
                    <strong className={block && blockSpent > block.minutes * 60000 ? 'over' : ''}>
                      {block ? `${mmss(blockSpent)} / ${block.minutes}m` : '—'}
                    </strong>
                  </div>
                </div>

                {status !== 'include' && (
                  <div className={`pv-callout ${status}`}>
                    {status === 'light' ? 'Run light. ' : 'Skipped for this client. '}
                    {slide.statusReason}
                  </div>
                )}
                {slide.kind === 'scales' || slide.kind === 'choices' ? (
                  <div className="pv-callout info">The client can tap answers on their screen. You can set them here too.</div>
                ) : null}

                {slide.kind === 'agenda' && <p className="pv-baseline">{w.objective}</p>}

                {slideNotes?.entries.length ? (
                  slideNotes.entries.map((e, i) => (
                    <div className="pv-entry" key={i}>
                      {e.label && <div className="pv-entry-label">{e.label}</div>}
                      {e.baselines.map((b, j) => (
                        <div key={j}>
                          <p className="pv-k">Baseline{b.label ? ` · ${b.label}` : ''}</p>
                          <p className="pv-baseline">{b.text}</p>
                        </div>
                      ))}
                      {e.ask && (
                        <>
                          <p className="pv-k">Ask</p>
                          <p className="pv-ask">{e.ask}</p>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="pv-empty">
                    {slide.question ? <>On screen: {plain(slide.question)}</> : 'No notes for this slide.'}
                  </p>
                )}

                {slide.kind === 'wordlists' && <WordLists slide={slide} answers={state.answers} act={act} />}
              </>
            ) : (
              <Brief workshop={w} notes={notes} />
            )}
          </div>
        </aside>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function WordLists({ slide, answers, act }: { slide: WorkshopSlide; answers: Record<string, unknown>; act: ReturnType<typeof useSession>['act'] }) {
  return (
    <div className="pv-words">
      {slide.columns?.map((c, i) => {
        const key = `${slide.id}.list.${i}`;
        const items = (answers[key] as string[] | undefined) ?? [];
        const add = (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('word') as HTMLInputElement;
          const words = input.value.split(',').map((x) => x.trim()).filter(Boolean);
          if (words.length) act({ type: 'answer', key, value: [...new Set([...items, ...words])] });
          input.value = '';
        };
        return (
          <div key={key}>
            <p className="pv-k">{c.title} (shown on screen)</p>
            <form onSubmit={add}>
              <input name="word" placeholder="Add a word, or several separated by commas" autoComplete="off" />
              <button className="btn">Add</button>
            </form>
            <div className="pv-wordchips">
              {items.map((x) => (
                <button key={x} title="Remove" onClick={() => act({ type: 'answer', key, value: items.filter((y) => y !== x) })}>
                  {x} ×
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Brief({ workshop: w, notes }: { workshop: Workshop; notes: WorkshopNotes }) {
  return (
    <div className="pv-brief">
      <h3>Objective</h3>
      <ul><li>{w.objective || 'Not written yet. Run Prepare.'}</li></ul>
      {notes.housekeeping.length > 0 && (
        <>
          <h3>Housekeeping</h3>
          <ul>{notes.housekeeping.map((h) => <li key={h}>{h}</li>)}</ul>
        </>
      )}
      {notes.recon.length > 0 && (
        <>
          <h3>Recon</h3>
          <ul>{notes.recon.map((r) => <li key={r.label + r.text}>{r.label && <b>{r.label}: </b>}{r.text}</li>)}</ul>
        </>
      )}
      {notes.knownFacts.length > 0 && (
        <>
          <h3>What we know</h3>
          <ul>{notes.knownFacts.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}
      <h3>Running order</h3>
      <ul>{w.blocks.map((b) => <li key={b.name}>{b.name}: {b.minutes} min</li>)}</ul>
    </div>
  );
}
