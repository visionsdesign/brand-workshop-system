import { plain } from '@/components/Rich';
import { REGISTRY } from '../registry';
import type { Workshop } from '../types';
import { buildWorkshop } from '../workshop';
import { portalStore } from './store';
import { isAnswered, partsFor } from './selfserve-client';
import type { PortalWorkshop, WorkshopFile } from './types';

export { HINTS, isAnswered, partsFor, slideAnswersView, spokenQuestion, valueKeys } from './selfserve-client';

// The self-serve workshop: the registry's question slides, answered by the
// client in their own time. Titles, the agenda, dividers and the break are left
// out because there's nothing to answer on them.

const ANSWERABLE = new Set(['question', 'cards', 'pyramid', 'scales', 'choices', 'wordlists', 'scenario', 'summary']);

export const SLIDE_IDS = new Set(REGISTRY.filter((s) => ANSWERABLE.has(s.kind)).map((s) => s.id));

/** A client's self-serve workshop: registry slides with {{BRAND}} filled, answerable ones only */
export function selfServeWorkshop(w: PortalWorkshop): Workshop {
  const built = buildWorkshop({
    slug: w.id,
    code: '',
    clientName: w.clientName,
    clientNameAr: '',
    date: '',
    objective: '',
    facilitators: [],
    attendees: [],
    knownFacts: [],
    overrides: {},
    bespoke: [],
    runningOrder: [],
  });
  return {
    ...built,
    slides: built.slides
      .filter((s) => SLIDE_IDS.has(s.id))
      .map(({ statusReason: _r, minutes: _m, block: _b, ...s }) => s),
  };
}

export async function markStarted(w: PortalWorkshop) {
  if (w.status === 'intake' || w.status === 'ready') {
    await portalStore().updateWorkshop(w.id, { status: 'in_progress' });
  }
}

const fmtSecs = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** Markdown export of a self-serve workshop, the input for Capture and the Brand DNA playbook */
export function answersMarkdown(w: PortalWorkshop, files: WorkshopFile[], baseUrl: string): string {
  const ws = selfServeWorkshop(w);
  const lines: string[] = [
    `# ${w.clientName}: self-serve workshop answers`,
    '',
    `Contact: ${w.contactName} (${w.contactEmail})`,
    w.submittedAt ? `Submitted: ${new Date(w.submittedAt).toUTCString()}` : 'Not submitted yet: answers so far.',
    '',
  ];
  for (const s of ws.slides) {
    const a = w.answers[s.id];
    const notes = files.filter((f) => f.slideId === s.id);
    lines.push(`## ${s.id} ${s.title}`, '', `Question: ${plain(s.question) || plain(s.sub) || s.title}`, '');
    if (!isAnswered(s, a, notes.length)) {
      lines.push('_No answer._', '');
      if (a?.chat?.length) {
        lines.push('AI facilitator conversation (client did not reply):', '');
        for (const t of a.chat) lines.push(`> **${t.role === 'user' ? 'Client' : 'AI'}:** ${t.content.replace(/\n+/g, ' ')}`);
        lines.push('');
      }
      continue;
    }
    s.scales?.forEach(([l, r], i) => {
      const v = a?.values?.[`${s.id}.scale.${i}`];
      if (typeof v === 'number') lines.push(`- ${l} ↔ ${r}: ${v}/10`);
    });
    s.groups?.forEach((g, i) => {
      const v = a?.values?.[`${s.id}.q${i}`];
      if (typeof v === 'number' && g.options[v]) lines.push(`- ${g.q} ${g.options[v]}`);
    });
    for (const p of partsFor(s)) {
      const v = a?.parts?.[p.key]?.trim();
      if (v) lines.push(`**${p.label}:** ${v}`, '');
    }
    if (a?.text?.trim()) lines.push(a.text.trim(), '');
    if (a?.chat?.length) {
      lines.push('AI facilitator conversation:', '');
      for (const t of a.chat) lines.push(`> **${t.role === 'user' ? 'Client' : 'AI'}:** ${t.content.replace(/\n+/g, ' ')}`);
      lines.push('');
    }
    for (const n of notes) {
      lines.push(
        `Voice note${n.seconds ? ` (${fmtSecs(n.seconds)})` : ''}: ${baseUrl}/api/portal/files/${n.id}`,
        n.transcript?.trim() ? `> ${n.transcript.trim()}` : '> No transcript: listen to the recording.',
        '',
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
