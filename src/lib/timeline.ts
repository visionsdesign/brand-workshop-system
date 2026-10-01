import type { SessionState, TimelineEvent, Workshop } from './types';

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
export function hms(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}
/** Like hms, but times before the recording started show as negative, e.g. −00:01:20 */
const rel = (ms: number) => (ms < -500 ? `−${hms(-ms)}` : hms(ms));
const mins = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
};

/** Human-readable answers, keyed by slide ID */
export function describeAnswers(w: Workshop, answers: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of w.slides) {
    const lines: string[] = [];
    s.scales?.forEach(([l, r], i) => {
      const v = answers[`${s.id}.scale.${i}`];
      if (typeof v === 'number') lines.push(`${l} ↔ ${r}: ${v}/10 (${v <= 5 ? `leans ${l}` : `leans ${r}`})`);
    });
    s.groups?.forEach((g, i) => {
      const v = answers[`${s.id}.q${i}`];
      if (typeof v === 'number' && g.options[v]) lines.push(`${g.q} ${g.options[v]}`);
    });
    s.columns?.forEach((c, i) => {
      const v = answers[`${s.id}.list.${i}`];
      if (Array.isArray(v) && v.length) lines.push(`${c.title}: ${v.join(', ')}`);
    });
    if (lines.length) out[s.id] = lines;
  }
  return out;
}

export function timelineMarkdown(w: Workshop, state: SessionState, events: TimelineEvent[]): string {
  const title = (id: string | null) => {
    const s = w.slides.find((x) => x.id === id);
    return s ? `${s.id} ${s.title}` : (id ?? '');
  };
  const recStart = [...events].reverse().find((e) => e.kind === 'recording' && e.note === 'start');
  const t0 = Date.parse(recStart?.at ?? events[0]?.at ?? new Date().toISOString());
  const slideEvents = events.filter((e) => e.kind === 'slide');
  const end = Date.now();

  const lines: string[] = [];
  lines.push(`# ${w.clientName}: workshop timeline`, '');
  lines.push(
    recStart
      ? `Recording clock started ${new Date(t0).toUTCString()}. Times are from that moment, so they match the call recording. Negative times happened before it.`
      : `The recording clock was never started, so times are from the first slide change (${new Date(t0).toUTCString()}).`,
    '',
  );

  lines.push('## Slide by slide', '', '| Time | Slide | On screen |', '|---|---|---|');
  slideEvents.forEach((e, i) => {
    const next = slideEvents[i + 1];
    const dur = (next ? Date.parse(next.at) : end) - Date.parse(e.at);
    lines.push(`| ${rel(Date.parse(e.at) - t0)} | ${title(e.slideId)} | ${mins(dur)} |`);
  });
  lines.push('');

  const markers = events.filter((e) => e.kind === 'marker');
  if (markers.length) {
    lines.push('## Moments flagged by the facilitator', '');
    for (const m of markers) lines.push(`- ${rel(Date.parse(m.at) - t0)}, ${title(m.slideId)}${m.note ? `: ${m.note}` : ''}`);
    lines.push('');
  }

  // Total time per slide (a slide can be visited more than once)
  const totals = new Map<string, number>();
  slideEvents.forEach((e, i) => {
    const next = slideEvents[i + 1];
    const dur = (next ? Date.parse(next.at) : end) - Date.parse(e.at);
    if (e.slideId) totals.set(e.slideId, (totals.get(e.slideId) ?? 0) + dur);
  });
  if (totals.size) {
    lines.push('## Time per slide', '', '| Slide | Planned | Actual |', '|---|---|---|');
    for (const s of w.slides) {
      const t = totals.get(s.id);
      if (t === undefined) continue;
      lines.push(`| ${s.id} ${s.title} | ${s.minutes ? `${Math.round(s.minutes)}m` : ''} | ${mins(t)} |`);
    }
    lines.push('');
  }

  const answers = describeAnswers(w, state.answers);
  if (Object.keys(answers).length) {
    lines.push('## Answers tapped in the session', '');
    for (const [id, a] of Object.entries(answers)) {
      lines.push(`### ${title(id)}`, '', ...a.map((x) => `- ${x}`), '');
    }
  }

  const skipped = w.slides.filter((s) => (state.overrides[s.id] ?? s.status) === 'skip').map((s) => s.id);
  if (skipped.length) lines.push(`Skipped in this session: ${skipped.join(', ')}`, '');

  return lines.join('\n');
}
