// Reads every clients/<slug>/client.md and facilitator-notes.md and writes
// src/content/generated/data.json for the app. Runs before `dev` and `build`.
//
// The parser is deliberately forgiving: it reads the tables and headings that
// clients/_template/client.md and the Prepare step produce, and reports what it
// couldn't find instead of failing.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CLIENTS = join(ROOT, 'clients');
const OUT_DIR = join(ROOT, 'src/content/generated');

const warnings = [];
const warn = (slug, msg) => warnings.push(`[${slug}] ${msg}`);

// ---------- markdown helpers ----------

/** Split a markdown doc into { heading, body } by a heading prefix like '## ' */
function sections(md, prefix) {
  const out = [];
  let cur = null;
  for (const line of md.split('\n')) {
    if (line.startsWith(prefix) && !line.startsWith(prefix + '#')) {
      cur = { heading: line.slice(prefix.length).trim(), lines: [] };
      out.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return out.map((s) => ({ heading: s.heading, body: s.lines.join('\n') }));
}

function tableRows(body) {
  const rows = [];
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
    rows.push(cells);
  }
  return rows.slice(1); // drop header row
}

const clean = (s) => (s ?? '').replace(/\*\*/g, '').trim();
const isMissing = (s) => !s || /^\[(DATA REQUIRED|confirm)/i.test(s) || /PASTE_|_HERE$/.test(s);
/** "Prefera (the intake form says ...)" -> "Prefera" */
const stripAside = (s) => clean(s).replace(/\s*\(.*$/, '').trim();

function bullets(body) {
  return body
    .split('\n')
    .filter((l) => /^\s*-\s+/.test(l))
    .map((l) => l.replace(/^\s*-\s+/, '').trim());
}

// ---------- client.md ----------

function parseClient(md, slug) {
  const secs = sections(md, '## ');
  const find = (re) => secs.find((s) => re.test(s.heading));
  const field = (sec, re) => {
    if (!sec) return '';
    const row = tableRows(sec.body).find((r) => re.test(r[0]));
    return row ? clean(row[1]) : '';
  };

  const s1 = find(/^1\.|client/i);
  const s2 = find(/^2\.|people/i);
  const s3 = find(/^3\.|workshop session/i);
  const s5 = find(/^5\.|what we know/i);
  const s6 = find(/^6\.|slide configuration/i);
  const s7 = find(/^7\.|running order/i);

  const nameRaw = field(s1, /brand name/i);
  const clientName = stripAside(nameRaw);
  if (!clientName) warn(slug, 'Client name missing in section 1.');

  const arRaw = field(s1, /other script|arabic/i);
  const clientNameAr = isMissing(arRaw) ? '' : stripAside(arRaw);

  const people = s2 ? tableRows(s2.body) : [];
  const names = (re) =>
    people
      .filter((r) => re.test(r[0]))
      .map((r) => clean(r[1]))
      .filter(Boolean)
      .flatMap((n) => n.split(/,| and /).map((x) => x.trim()))
      .filter(Boolean);
  const facilitators = names(/visions facilitator/i);
  const attendees = [...names(/decision-maker/i), ...names(/other client attendees/i)];

  const dateRaw = field(s3, /^date/i);
  const date = isMissing(dateRaw) ? '' : stripAside(dateRaw);
  let code = field(s3, /link code/i);
  if (isMissing(code)) {
    code = `${slug}-${createHash('sha256').update(`visions:${slug}`).digest('hex').slice(0, 6)}`;
    warn(slug, `No "Workshop link code" in section 3. Using ${code}. Add it to client.md to keep the link stable.`);
  }

  // Slide configuration + bespoke slides (both tables live under section 6)
  const overrides = {};
  const bespoke = [];
  if (s6) {
    const [configPart, bespokePart = ''] = s6.body.split(/^###\s+Bespoke.*$/im);
    for (const r of tableRows(configPart)) {
      const id = clean(r[0]).toUpperCase();
      const action = clean(r[1]).toLowerCase();
      if (!/^[A-Z]\d{2}$/.test(id)) continue;
      if (!['skip', 'light', 'include'].includes(action)) {
        warn(slug, `Slide ${id}: unknown action "${r[1]}"`);
        continue;
      }
      overrides[id] = { action, reason: clean(r[2]) };
    }
    for (const r of tableRows(bespokePart)) {
      const id = clean(r[0]).toUpperCase();
      if (!/^B\d{2}$/.test(id) || !clean(r[1])) continue;
      bespoke.push({ id, title: clean(r[1]), question: clean(r[2]), after: clean(r[3]).toUpperCase() });
    }
  }

  const runningOrder = s7
    ? tableRows(s7.body)
        .filter((r) => clean(r[0]) && !/^total$/i.test(clean(r[0])))
        .map((r) => ({ name: clean(r[0]), slides: clean(r[1]), minutes: Number(clean(r[2])) || 0 }))
    : [];

  return {
    slug,
    code,
    clientName,
    clientNameAr,
    date,
    facilitators,
    attendees,
    knownFacts: s5 ? bullets(s5.body).map(clean) : [],
    overrides,
    bespoke,
    runningOrder,
  };
}

// ---------- facilitator-notes.md ----------

const LABEL_LINE = /^[A-Z][A-Z0-9 &()/,.'’-]{3,}$/; // e.g. FOR PEOPLE (PREFERA APP)

function parseSlideNotes(body) {
  const entries = [];
  let cur = null;
  const ensure = (label) => {
    if (!cur || (label !== undefined && cur.label !== label)) {
      cur = { label: label || '', baselines: [], ask: '' };
      entries.push(cur);
    }
    return cur;
  };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line === '---') continue;
    if (LABEL_LINE.test(line) && !/:/.test(line)) {
      cur = null;
      ensure(line);
      continue;
    }
    let m = line.match(/^Baseline(?:\s*\(([^)]+)\))?:\s*(.*)$/i);
    if (m) {
      const e = ensure();
      e.baselines.push({ label: m[1] || '', text: m[2] });
      continue;
    }
    m = line.match(/^Steering Prompt:\s*(.*)$/i);
    if (m) {
      const e = ensure();
      e.ask = m[1].replace(/^["“]|["”]$/g, '');
      continue;
    }
    // continuation of the previous paragraph
    if (cur) {
      if (cur.ask) cur.ask += ' ' + line;
      else if (cur.baselines.length) cur.baselines[cur.baselines.length - 1].text += ' ' + line;
    }
  }
  return entries;
}

function parseNotes(md, slug) {
  const h2 = sections(md, '## ');
  const objSec = h2.find((s) => /objective/i.test(s.heading));
  const objective = objSec ? objSec.body.split('\n').map((l) => l.trim()).find((l) => l && l !== '---') ?? '' : '';
  if (!objective) warn(slug, 'No "## Workshop Objective" in facilitator-notes.md.');

  const reconSec = h2.find((s) => /recon/i.test(s.heading));
  const recon = reconSec
    ? bullets(reconSec.body).map((b) => {
        const m = b.match(/^\*\*(.+?):\*\*\s*(.*)$/);
        return m ? { label: m[1], text: m[2] } : { label: '', text: clean(b) };
      })
    : [];

  const hkSec = h2.find((s) => /housekeeping/i.test(s.heading));
  const housekeeping = hkSec ? bullets(hkSec.body) : [];

  const slides = {};
  for (const s of sections(md, '### ')) {
    const m = s.heading.match(/^([A-Z]\d{2})\b\s*(.*)$/);
    if (!m) continue;
    // stop the body at the next H2
    const body = s.body.split(/^## /m)[0];
    slides[m[1]] = { title: m[2], entries: parseSlideNotes(body) };
  }
  return { objective, recon, housekeeping, slides };
}

// ---------- main ----------

const workshops = {};
const notes = {};

for (const slug of readdirSync(CLIENTS)) {
  if (slug.startsWith('_') || slug.startsWith('.')) continue;
  const dir = join(CLIENTS, slug);
  const clientPath = join(dir, 'client.md');
  if (!existsSync(clientPath)) continue;
  const client = parseClient(readFileSync(clientPath, 'utf8'), slug);
  const notesPath = join(dir, 'facilitator-notes.md');
  const n = existsSync(notesPath)
    ? parseNotes(readFileSync(notesPath, 'utf8'), slug)
    : (warn(slug, 'No facilitator-notes.md yet. Run Prepare first.'), { objective: '', recon: [], housekeeping: [], slides: {} });

  if (Object.values(workshops).some((w) => w.code === client.code)) {
    warn(slug, `Link code ${client.code} is already used by another client.`);
  }
  workshops[slug] = { ...client, objective: n.objective };
  notes[slug] = { recon: n.recon, housekeeping: n.housekeeping, slides: n.slides };
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'workshops.json'), JSON.stringify(workshops, null, 2));
writeFileSync(join(OUT_DIR, 'notes.json'), JSON.stringify(notes, null, 2));

console.log(`content: ${Object.keys(workshops).length} workshop(s): ${Object.values(workshops).map((w) => `${w.slug} → /w/${w.code}`).join(', ')}`);
for (const w of warnings) console.warn('content: ' + w);
