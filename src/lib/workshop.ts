import { REGISTRY, SECTION_TOPICS, bespokeSlide } from './registry';
import type { AgendaRow, SlideDef, Workshop, WorkshopSlide } from './types';

/** Shape written by scripts/build-content.mjs */
export interface RawWorkshop {
  slug: string;
  code: string;
  clientName: string;
  clientNameAr: string;
  date: string;
  objective: string;
  facilitators: string[];
  attendees: string[];
  knownFacts: string[];
  overrides: Record<string, { action: 'include' | 'light' | 'skip'; reason: string }>;
  bespoke: { id: string; title: string; question: string; after: string }[];
  runningOrder: { name: string; slides: string; minutes: number }[];
}

const fill = (s: string | undefined, brand: string) => s?.replaceAll('{{BRAND}}', brand);

/** "D01, S01 to S04, B01" -> ['D01','S01','S02','S03','S04','B01'] using the slide order */
function expandSlideList(spec: string, order: string[]): string[] {
  const ids: string[] = [];
  for (const part of spec.split(',').map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^([A-Z]\d{2})\s*(?:to|-|–)\s*([A-Z]\d{2})$/i);
    if (range) {
      const a = order.indexOf(range[1].toUpperCase());
      const b = order.indexOf(range[2].toUpperCase());
      if (a >= 0 && b >= a) {
        // A range only covers registry slides of the same prefix; bespoke slides are listed explicitly
        const prefix = range[1][0].toUpperCase();
        ids.push(...order.slice(a, b + 1).filter((id) => id[0] === prefix));
      }
    } else if (/^[A-Z]\d{2}$/i.test(part)) {
      ids.push(part.toUpperCase());
    }
  }
  return ids;
}

export function buildWorkshop(raw: RawWorkshop): Workshop {
  const brand = raw.clientName || 'Your Brand';

  // 1. Registry order with bespoke slides inserted after their anchors
  const slides: (SlideDef & { bespoke?: boolean })[] = [...REGISTRY];
  for (const b of raw.bespoke) {
    const at = slides.findIndex((s) => s.id === b.after);
    const anchor = slides[at];
    const def = { ...bespokeSlide(b.id, b.title, b.question, anchor?.section ?? ''), bespoke: true };
    if (at >= 0) slides.splice(at + 1, 0, def);
    else slides.splice(slides.length - 1, 0, def); // unknown anchor: before the close
  }
  const order = slides.map((s) => s.id);

  // 2. Running order blocks -> slide membership and per-slide minutes
  const blockOf = new Map<string, string>();
  const minutesOf = new Map<string, number>();
  const blocks = raw.runningOrder.map((b) => {
    const ids = expandSlideList(b.slides, order).filter((id) => order.includes(id));
    ids.forEach((id) => blockOf.set(id, b.name));
    const status = (id: string) => raw.overrides[id]?.action ?? 'include';
    // Dividers take no time; the block's minutes are shared across its live slides
    const timed = ids.filter((id) => id[0] !== 'D' && status(id) !== 'skip');
    timed.forEach((id) => minutesOf.set(id, b.minutes / Math.max(timed.length, 1)));
    return { name: b.name, minutes: b.minutes, ids };
  });

  const resolved: WorkshopSlide[] = slides.map((s) => {
    const o = raw.overrides[s.id];
    return {
      ...s,
      question: fill(s.question, brand),
      sub: fill(s.sub, brand),
      status: o?.action ?? 'include',
      statusReason: o?.reason,
      block: blockOf.get(s.id),
      minutes: minutesOf.get(s.id),
    };
  });

  // 3. Agenda: every block except the welcome, in order, with topics
  const agenda: AgendaRow[] = blocks
    .filter((b) => !b.ids.every((id) => id === 'S00' || id === 'A01'))
    .map((b) => {
      const sectionSlides = resolved.filter((s) => b.ids.includes(s.id));
      const sectionName = sectionSlides.find((s) => s.kind === 'divider')?.section;
      const topics = sectionName && SECTION_TOPICS[sectionName]
        ? SECTION_TOPICS[sectionName]
        : sectionSlides.filter((s) => s.bespoke).map((s) => s.eyebrow ?? s.label);
      // "Narrative & Voice (light)" -> "Narrative & Voice": planning asides aren't for the client
      return { name: b.name.replace(/\s*\(.*?\)\s*$/, ''), minutes: b.minutes, topics: [...new Set(topics)] };
    });

  return {
    slug: raw.slug,
    code: raw.code,
    clientName: brand,
    clientNameAr: raw.clientNameAr,
    date: raw.date,
    objective: raw.objective,
    facilitators: raw.facilitators,
    attendees: raw.attendees,
    agenda,
    blocks: blocks.map(({ name, minutes }) => ({ name, minutes })),
    slides: resolved,
  };
}
