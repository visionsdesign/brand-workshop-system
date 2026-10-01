'use client';

import { useSession } from '@/lib/sync';
import type { SessionState, Workshop } from '@/lib/types';
import { Slide } from './Slide';
import { SlideFrame } from './SlideFrame';

const INTERACTIVE = new Set(['scales', 'choices']);

/** What the client sees: whichever slide the facilitator is on, full screen. */
export function ClientView({ workshop, initial }: { workshop: Workshop; initial: SessionState }) {
  const { state, act, connection } = useSession(workshop.code, initial);
  const slide = workshop.slides.find((s) => s.id === state.current) ?? workshop.slides[0];
  const interactive = INTERACTIVE.has(slide.kind);

  return (
    <main className="client">
      <SlideFrame>
        <Slide
          slide={slide}
          ctx={workshop}
          answers={state.answers}
          onAnswer={interactive ? (key, value) => act({ type: 'answer', key, value }) : undefined}
        />
      </SlideFrame>

      {interactive && <div className="client-hint">Tap to answer. Your facilitator sees it live.</div>}

      <div className={`client-status ${connection === 'offline' ? 'is-alert' : ''}`}>
        <span className={`dot ${connection === 'live' ? 'live' : connection}`} />
        {connection === 'offline' ? 'Reconnecting…' : 'Following your facilitator'}
      </div>
    </main>
  );
}
