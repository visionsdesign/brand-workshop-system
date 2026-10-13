// Pure self-serve helpers, safe for the browser (no server imports).
import type { WorkshopSlide } from '../types';
import type { SlideAnswer } from './types';

/**
 * Extra guidance where a facilitator would normally explain the exercise.
 * Client-facing, so written to the client.
 */
export const HINTS: Record<string, string> = {
  S01: 'Tell the story as you would to a friend: where you were, what happened, what you decided.',
  S02: 'Write it in your client’s voice, as if they were the one leaving. A few lines is plenty.',
  S03: 'Describe the old way people did things, then the new reality you are creating.',
  S04: 'Think five years out: size, reach, products, reputation. Be ambitious.',
  S06: 'One sentence. Try: We help [who] to [do what] so they can [result].',
  S07: 'List four or five rules your team never breaks, with a line on each.',
  S10: 'Fill in each bracket in a few words. Being specific beats being clever.',
  S11: 'Three words or short phrases. Imagine overhearing a customer describing you.',
  S12: 'If you sell to more than one type of customer, answer for each one.',
  S13: 'If you sell to more than one type of customer, answer for each one.',
  S19: 'The Core is one belief. The Pillars are the proof. The Flex is how the story changes for different people.',
  S20: 'Pick a point on each scale, on the slide or with the buttons below. There are no right answers.',
  S21: 'Pick the option that fits best for each question, on the slide or below.',
  S22: 'Separate words or phrases with commas.',
  S23: 'Rewrite the line the way your brand would say it.',
  S25: 'Anything you want us to know, or any questions for the team.',
};

/** Named sub-answers a slide asks for (cards, pyramid tiers, word lists) */
export function partsFor(s: WorkshopSlide): { key: string; label: string; prompt?: string }[] {
  if (s.cards) return s.cards.map((c) => ({ key: c.title, label: c.title, prompt: c.prompt }));
  if (s.tiers) return s.tiers.map((t) => ({ key: t.name, label: t.name, prompt: t.prompt }));
  if (s.columns) return s.columns.map((c) => ({ key: c.title, label: c.title, prompt: c.desc }));
  return [];
}

/** Keys of tapped answers on interactive slides, matching the live session */
export function valueKeys(s: WorkshopSlide): string[] {
  if (s.scales) return s.scales.map((_, i) => `${s.id}.scale.${i}`);
  if (s.groups) return s.groups.map((_, i) => `${s.id}.q${i}`);
  return [];
}

/** For rendering a slide: tapped values plus word lists split out of the parts */
export function slideAnswersView(s: WorkshopSlide, a: SlideAnswer | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(a?.values ?? {}) };
  s.columns?.forEach((c, i) => {
    const words = (a?.parts?.[c.title] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (words.length) out[`${s.id}.list.${i}`] = words;
  });
  return out;
}

export function isAnswered(s: WorkshopSlide, a: SlideAnswer | undefined, voiceNotes: number): boolean {
  if (voiceNotes > 0) return true;
  if (!a) return false;
  if (a.text?.trim()) return true;
  if (Object.values(a.parts ?? {}).some((v) => v?.trim())) return true;
  if (Object.values(a.values ?? {}).some((v) => v !== null && v !== undefined)) return true;
  // A conversation with the AI facilitator counts once the client has replied
  if (a.chat?.some((t) => t.role === 'user')) return true;
  return false;
}


const strip = (t?: string) => (t ?? '').replace(/\*\*(.+?)\*\*|\(\((.+?)\)\)/g, '$1$2').replace(/\s*\n+\s*/g, ' ').trim();

/** What gets read aloud for a question: the slide's own words, plus its parts, scales or options */
export function spokenQuestion(s: WorkshopSlide): string {
  const bits: string[] = [];
  if (s.eyebrow) bits.push(`${s.eyebrow}.`);
  if (s.question) bits.push(strip(s.question));
  if (s.sub) bits.push(strip(s.sub));
  s.cards?.forEach((c) => bits.push(`${c.title}: ${c.prompt}`));
  s.tiers?.forEach((t) => bits.push(`${t.name}. ${t.prompt}`));
  if (s.scales) bits.push(`For each pair, choose where your brand sits. ${s.scales.map(([l, r]) => `${l}, or ${r}`).join('. ')}.`);
  s.groups?.forEach((g) => bits.push(g.q));
  s.columns?.forEach((c) => bits.push(`${c.title}: ${c.desc.replace(/[()]/g, '')}`));
  if (!bits.length) bits.push(s.title);
  return bits.join(' ').replace(/\.\./g, '.');
}
