// Server-only: loads generated client content. Never import this from a client component,
// it would ship every client's facilitator notes to the browser.
import workshopsJson from '@/content/generated/workshops.json';
import notesJson from '@/content/generated/notes.json';
import type { Workshop, WorkshopNotes } from './types';
import { buildWorkshop, type RawWorkshop } from './workshop';

const raw = workshopsJson as unknown as Record<string, RawWorkshop>;
const notes = notesJson as unknown as Record<string, Omit<WorkshopNotes, 'knownFacts'>>;

export function getWorkshopByCode(code: string): Workshop | null {
  const w = Object.values(raw).find((r) => r.code === code);
  return w ? buildWorkshop(w) : null;
}

/** Facilitated workshops prepared in the repo (clients/<slug>/), for the team dashboard */
export function listRepoWorkshops() {
  return Object.values(raw).map((r) => ({ slug: r.slug, code: r.code, clientName: r.clientName, date: r.date }));
}

/** What the client's browser receives: slide content only, no planning reasons or timings */
export function publicWorkshop(w: Workshop): Workshop {
  return {
    ...w,
    blocks: [],
    slides: w.slides.map(({ statusReason: _r, minutes: _m, block: _b, ...s }) => s),
  };
}

export function getNotes(slug: string): WorkshopNotes {
  const n = notes[slug];
  return {
    recon: n?.recon ?? [],
    housekeeping: n?.housekeeping ?? [],
    slides: n?.slides ?? {},
    knownFacts: raw[slug]?.knownFacts ?? [],
  };
}
