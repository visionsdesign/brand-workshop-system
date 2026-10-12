export type Theme = 'dark' | 'light' | 'gradient';

export type SlideKind =
  | 'title'
  | 'agenda'
  | 'divider'
  | 'question'
  | 'cards'
  | 'pyramid'
  | 'scales'
  | 'choices'
  | 'wordlists'
  | 'scenario'
  | 'break'
  | 'summary';

export type SlideStatus = 'include' | 'light' | 'skip';

/**
 * Rich text on slides uses two marks, matching the Figma template:
 *   **text**  -> full white, used on slides whose base tone is muted
 *   ((text))  -> 40% white, used on slides whose base tone is white
 * A blank line ("\n\n") becomes a paragraph break.
 */
export type RichText = string;

export interface SlideDef {
  id: string;
  kind: SlideKind;
  theme: Theme;
  /** Background image in /public/img, for gradient slides */
  bg?: string;
  /** Short name for lists and notes, e.g. "The Spark" */
  title: string;
  /** Header left label */
  label: string;
  /** Header right label (section) */
  section: string;
  eyebrow?: string;
  question?: RichText;
  /** Base colour of the question text */
  tone?: 'white' | 'muted';
  sub?: RichText;
  /** Larger sub-line (56px) instead of the default 32px */
  subLarge?: boolean;
  cards?: { title: string; prompt: string }[];
  tiers?: { name: string; prompt: string }[];
  scales?: [string, string][];
  groups?: { q: string; options: string[] }[];
  columns?: { title: string; desc: string }[];
  /** Which Figma frame this came from, for reference */
  figmaNode?: string;
}

export interface AgendaRow {
  name: string;
  minutes: number;
  topics: string[];
}

/** A slide as it appears in a client's workshop */
export interface WorkshopSlide extends SlideDef {
  status: SlideStatus;
  statusReason?: string;
  block?: string;
  /** Planned minutes for this slide (block minutes split across its slides) */
  minutes?: number;
  bespoke?: boolean;
}

export interface Workshop {
  slug: string;
  code: string;
  clientName: string;
  clientNameAr: string;
  date: string;
  objective: string;
  facilitators: string[];
  attendees: string[];
  agenda: AgendaRow[];
  blocks: { name: string; minutes: number }[];
  slides: WorkshopSlide[];
}

export interface NoteEntry {
  label: string;
  baselines: { label: string; text: string }[];
  ask: string;
}

export interface WorkshopNotes {
  recon: { label: string; text: string }[];
  housekeeping: string[];
  knownFacts: string[];
  slides: Record<string, { title: string; entries: NoteEntry[] }>;
}

/** Live session state shared between facilitator and client */
export interface SessionState {
  current: string | null;
  overrides: Record<string, SlideStatus>;
  answers: Record<string, unknown>;
  recordingStartedAt: string | null;
  rev: number;
}

export type SessionAction =
  | { type: 'slide'; slideId: string }
  | { type: 'answer'; key: string; value: unknown }
  | { type: 'override'; slideId: string; status: SlideStatus | null }
  | { type: 'recording'; start: boolean }
  | { type: 'marker'; slideId: string; note?: string }
  /** Clears the timeline and recording clock; timing restarts from the current slide */
  | { type: 'reset' };

export interface TimelineEvent {
  kind: 'slide' | 'marker' | 'recording';
  slideId: string | null;
  note?: string | null;
  at: string;
}
