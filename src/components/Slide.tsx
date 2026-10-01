'use client';

import { useRef, useState, type CSSProperties } from 'react';
import type { AgendaRow, WorkshopSlide } from '@/lib/types';
import { Rich } from './Rich';

/** Workshop-level details a slide may need */
export interface SlideContext {
  clientName: string;
  clientNameAr: string;
  date: string;
  objective: string;
  agenda: AgendaRow[];
}

interface Props {
  slide: WorkshopSlide;
  ctx: SlideContext;
  answers: Record<string, unknown>;
  /** When set, scales and choices respond to clicks */
  onAnswer?: (key: string, value: unknown) => void;
}

/** One slide, drawn on a fixed 1920 × 1080 canvas exactly like the Figma frame. Scale it with <SlideFrame>. */
export function Slide({ slide, ctx, answers, onAnswer }: Props) {
  const cls = `slide theme-${slide.theme} kind-${slide.kind} tone-${slide.tone ?? 'white'}`;
  const header = headerFor(slide, ctx);

  return (
    <div className={cls} data-slide={slide.id}>
      {slide.bg && <img className="slide-bg" src={`/img/${slide.bg}`} alt="" />}
      {slide.theme === 'dark' && slide.kind !== 'agenda' && slide.kind !== 'scales' && (
        <img className="slide-glow" src="/img/glow.svg" alt="" />
      )}

      <header className="slide-header">
        <span>{header.left}</span>
        <span>{header.right}</span>
      </header>

      <Body slide={slide} ctx={ctx} answers={answers} onAnswer={onAnswer} />

      <footer className="slide-footer">© Visions Design</footer>
    </div>
  );
}

function headerFor(slide: WorkshopSlide, ctx: SlideContext) {
  switch (slide.kind) {
    case 'title':
      return { left: 'Brand workshop', right: ctx.date };
    case 'divider':
    case 'summary':
    case 'break':
      return { left: slide.label, right: '' };
    default:
      return { left: slide.label, right: slide.section };
  }
}

function Body({ slide, ctx, answers, onAnswer }: Props) {
  switch (slide.kind) {
    case 'title':
      return (
        <div className="s-center">
          <h1 className="s-display">{ctx.clientName}</h1>
          {ctx.clientNameAr && <p className="s-display-ar" dir="rtl" lang="ar">{ctx.clientNameAr}</p>}
        </div>
      );

    case 'divider':
      return (
        <div className="s-center">
          <h1 className="s-display">{slide.title}</h1>
        </div>
      );

    case 'agenda':
      return <Agenda ctx={ctx} />;

    case 'question':
    case 'summary':
      return (
        <div className="s-center s-question-wrap">
          {slide.eyebrow && <p className="s-eyebrow">{slide.eyebrow}</p>}
          <h2 className="s-question"><Rich text={slide.question} /></h2>
          {slide.sub && (
            <p className={slide.subLarge || slide.kind === 'summary' ? 's-sub s-sub-lg' : 's-sub'}>
              <Rich text={slide.sub} />
            </p>
          )}
        </div>
      );

    case 'scenario':
      return (
        <div className="s-center s-question-wrap">
          <h2 className="s-question s-quote"><Rich text={slide.question} /></h2>
          <p className="s-sub s-sub-lg"><Rich text={slide.sub} /></p>
        </div>
      );

    case 'cards':
      return (
        <div className="s-center s-cards-wrap">
          {slide.question && <h2 className="s-question"><Rich text={slide.question} /></h2>}
          <div className="s-cards">
            {slide.cards?.map((c) => (
              <div className="s-card" key={c.title}>
                <p className="s-card-title">{c.title}</p>
                <p className="s-card-prompt">{c.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'pyramid':
      return <Pyramid slide={slide} />;

    case 'scales':
      return <Scales slide={slide} answers={answers} onAnswer={onAnswer} />;

    case 'choices':
      return <Choices slide={slide} answers={answers} onAnswer={onAnswer} />;

    case 'wordlists':
      return (
        <>
          <div className="s-wl-divider" />
          {slide.columns?.map((c, i) => {
            const items = (answers[`${slide.id}.list.${i}`] as string[] | undefined) ?? [];
            return (
              <div className={`s-wl-col s-wl-col-${i}`} key={c.title}>
                <p className="s-wl-head"><strong>{c.title}</strong> {c.desc}</p>
                {items.length ? (
                  <ul className="s-wl-items">{items.map((w) => <li key={w}>{w}</li>)}</ul>
                ) : (
                  <p className="s-wl-pending">pending</p>
                )}
              </div>
            );
          })}
        </>
      );

    case 'break':
      return (
        <div className="s-center s-break">
          <p className="s-question">
            Time for a break! <img className="s-break-pill" src="/img/break-brew.jpg" alt="" />
          </p>
          <p className="s-question">Get some fresh air and a brew.</p>
        </div>
      );
  }
}

function Agenda({ ctx }: { ctx: SlideContext }) {
  const rows = ctx.agenda;
  const rowH = Math.min(158, 700 / Math.max(rows.length, 1));
  return (
    <>
      <p className="s-agenda-title">Workshop agenda</p>
      <p className="s-agenda-objective">{ctx.objective}</p>
      <div className="s-agenda-rows">
        {rows.map((r, i) => (
          <div className="s-agenda-row" key={r.name} style={{ height: rowH }}>
            <span>({String(i + 1).padStart(2, '0')}) {r.name}{r.minutes ? ` (${r.minutes} mins)` : ''}</span>
            <span className="s-agenda-topics">{r.topics.map((t) => <span key={t}>{t}</span>)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Pyramid({ slide }: { slide: WorkshopSlide }) {
  // Geometry from the Figma frame: apex (520, 159), base y 812 from x 142 to 898
  return (
    <>
      <svg className="s-pyramid" width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden>
        <defs>
          <linearGradient id="pyr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c1c1c" />
            <stop offset="1" stopColor="#050505" />
          </linearGradient>
        </defs>
        <path d="M520 159 L898 812 L142 812 Z" fill="url(#pyr)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <line x1="394.3" y1="376.8" x2="645.7" y2="376.8" stroke="rgba(255,255,255,0.35)" />
        <line x1="270.2" y1="593.7" x2="769.8" y2="593.7" stroke="rgba(255,255,255,0.35)" />
      </svg>
      {slide.tiers?.map((t, i) => (
        <div key={t.name}>
          <p className={`s-tier-name s-tier-${i}`}>{t.name}</p>
          <p className={`s-tier-prompt s-tier-prompt-${i}`}>{t.prompt}</p>
        </div>
      ))}
      <p className="s-pyramid-q">{slide.question}</p>
    </>
  );
}

const TRACK_X = 616;
const TRACK_W = 660;
const tickX = (v: number) => TRACK_X + ((v - 1) / 9) * TRACK_W;

function Scales({ slide, answers, onAnswer }: Omit<Props, 'ctx'>) {
  // State drives the knob while dragging; the ref is read on pointerup, which can
  // fire before React re-renders on a quick tap
  const [drag, setDragState] = useState<{ row: number; value: number } | null>(null);
  const dragRef = useRef<{ row: number; value: number } | null>(null);
  const setDrag = (d: { row: number; value: number } | null) => {
    dragRef.current = d;
    setDragState(d);
  };

  const valueAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const scale = r.width / (TRACK_W + 32); // hit area is the track plus 16px each side
    const x = (clientX - r.left) / scale - 16;
    return Math.min(10, Math.max(1, Math.round((x / TRACK_W) * 9) + 1));
  };

  return (
    <div>
      {slide.scales?.map(([l, r], i) => {
        const line = 192 + i * 91.4;
        const saved = answers[`${slide.id}.scale.${i}`];
        const value = drag?.row === i ? drag.value : typeof saved === 'number' ? saved : null;
        return (
          <div key={l} className="s-scale" style={{ '--line': `${line}px` } as CSSProperties}>
            <span className="s-scale-l">{l}</span>
            <span className="s-scale-r">{r}</span>
            <span className="s-scale-min">01</span>
            <span className="s-scale-max">10</span>
            <span className="s-scale-track" />
            {Array.from({ length: 10 }, (_, k) => (
              <span key={k} className="s-scale-tick" style={{ left: tickX(k + 1) }} />
            ))}
            <span
              className={value === null ? 's-scale-knob is-unset' : 's-scale-knob'}
              style={{ left: tickX(value ?? 5) - 13 }}
            />
            {onAnswer && (
              <div
                className="s-scale-hit"
                role="slider"
                aria-label={`${l} to ${r}`}
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={value ?? undefined}
                tabIndex={0}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  setDrag({ row: i, value: valueAt(e.clientX, e.currentTarget) });
                }}
                onPointerMove={(e) => {
                  if (dragRef.current?.row === i) setDrag({ row: i, value: valueAt(e.clientX, e.currentTarget) });
                }}
                onPointerUp={() => {
                  const d = dragRef.current;
                  if (d?.row === i) onAnswer(`${slide.id}.scale.${i}`, d.value);
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => {
                  const cur = typeof saved === 'number' ? saved : 5;
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    onAnswer(`${slide.id}.scale.${i}`, Math.min(10, Math.max(1, cur + (e.key === 'ArrowLeft' ? -1 : 1))));
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Choices({ slide, answers, onAnswer }: Omit<Props, 'ctx'>) {
  const groups = slide.groups ?? [];
  const half = Math.ceil(groups.length / 2);
  const col = (from: number, to: number) => (
    <div className="s-choice-col">
      {groups.slice(from, to).map((g, j) => {
        const gi = from + j;
        const picked = answers[`${slide.id}.q${gi}`];
        return (
          <fieldset className="s-choice-group" key={g.q}>
            <legend>{g.q}</legend>
            {g.options.map((o, oi) => (
              <button
                type="button"
                key={o}
                className={picked === oi ? 's-choice is-picked' : 's-choice'}
                disabled={!onAnswer}
                aria-pressed={picked === oi}
                onClick={() => onAnswer?.(`${slide.id}.q${gi}`, picked === oi ? null : oi)}
              >
                <span className="s-radio" />
                {o}
              </button>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
  return (
    <div className="s-choices">
      {col(0, half)}
      {col(half, groups.length)}
    </div>
  );
}
