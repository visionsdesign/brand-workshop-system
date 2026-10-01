import type { SlideDef } from './types';

/**
 * The master Brand DNA Workshop, transcribed from Dom's Figma template
 * (file dKi1IANLZvTn2ooxYH1o9d). Copy is on-slide copy; client details are
 * filled from client.md at render time ({{BRAND}} is replaced with the client name).
 *
 * IDs match the slide registry in DESIGN.md §5. A01 (agenda), X01 (break) and
 * D04 (wrap-up divider) were added to match the Figma file.
 */

const CORE = 'The Core DNA';
const AUDIENCE = 'Alignment & Audience';
const VOICE = 'Narrative & Voice';
const WRAP = 'Wrap-Up';

export const SECTION_TOPICS: Record<string, string[]> = {
  [CORE]: ['Vision & Ambition', 'Brand Strategy'],
  [AUDIENCE]: ['Ecosystem & Routing'],
  [VOICE]: ['Verbal Identity'],
  [WRAP]: ['Final Questions'],
};

export const REGISTRY: SlideDef[] = [
  { id: 'S00', kind: 'title', theme: 'gradient', bg: 'bg-title.jpg', title: 'Title', label: 'Brand workshop', section: '', figmaNode: '131:157' },
  { id: 'A01', kind: 'agenda', theme: 'dark', title: 'Workshop Agenda', label: 'Contents', section: '', figmaNode: '131:189' },

  // ---- Section 1 ----
  { id: 'D01', kind: 'divider', theme: 'gradient', bg: 'bg-core.jpg', title: CORE, label: CORE, section: CORE, figmaNode: '131:165' },
  {
    id: 'S01', kind: 'question', theme: 'dark', title: 'The Spark', label: 'The Spark', section: CORE, eyebrow: 'Your Journey', tone: 'muted',
    question: "What was the exact moment or frustration that made you say, **'This industry is broken, and we have to fix it'?**",
    figmaNode: '131:225',
  },
  {
    id: 'S02', kind: 'question', theme: 'dark', title: 'The Breakup', label: 'The Breakup', section: CORE, tone: 'muted',
    question: 'Write a breakup letter from one of **your clients** to your **biggest competitor**.\n\n**Why are they leaving them for you?**',
    figmaNode: '131:235',
  },
  {
    id: 'S03', kind: 'question', theme: 'dark', title: 'The Paradigm Shift', label: 'The Paradigm Shift', section: CORE, tone: 'muted',
    question: 'What is the specific industry **friction, outdated norm**, or manual **pain point** your brand is actively destroying?',
    sub: 'The Old Way vs The New Reality', subLarge: true,
    figmaNode: '131:215',
  },
  { id: 'S04', kind: 'question', theme: 'light', title: 'Vision & Ambition: The 5 Year Horizon', label: 'Vision & Ambition', section: CORE, eyebrow: 'The 5 Year Horizon', question: 'Where is this brand going?', figmaNode: '131:354' },
  { id: 'S05', kind: 'question', theme: 'light', title: 'Vision & Ambition: The Internal Mandate', label: 'Vision & Ambition', section: CORE, eyebrow: 'The Internal Mandate', question: 'What is the strict operational directive your team executes every single day?', figmaNode: '131:363' },
  { id: 'S06', kind: 'question', theme: 'light', title: 'Vision & Ambition: The External Pitch', label: 'Vision & Ambition', section: CORE, eyebrow: 'The External Pitch', question: 'If you had to explain what you do to a prospect in one sentence, what is it?', figmaNode: '131:372' },
  {
    id: 'S07', kind: 'question', theme: 'dark', title: 'Core Beliefs: The Non-Negotiables', label: 'Core Beliefs', section: CORE, eyebrow: 'The Non-Negotiables', tone: 'muted',
    question: 'What are the **4-5 non-negotiable** operational standards that dictate your internal **culture and speed**?',
    figmaNode: '131:381',
  },
  {
    id: 'S08', kind: 'question', theme: 'dark', title: 'The Scaling Mantra', label: 'The Scaling Mantra', section: CORE, tone: 'muted',
    question: 'When you **scale** from 50 to 500 employees across three continents, what must remain **absolutely constant** about how your team operates daily?',
    sub: "We aren't looking for marketing values here. We are looking for the battle cries.",
    figmaNode: '131:391',
  },
  {
    id: 'S09', kind: 'question', theme: 'dark', title: 'The Moat & The Pillars', label: 'The Moat & The Pillars', section: CORE,
    question: 'What is your unfair structural advantage?',
    sub: 'This is the tangible, undeniable proof, the technology, process, or asset that competitors simply cannot replicate easily.',
    figmaNode: '131:401',
  },
  {
    id: 'S10', kind: 'question', theme: 'dark', title: 'The Onlyness Statement', label: 'The Onlyness Statement', section: CORE,
    question: '(({{BRAND}})) is the ONLY (([Category])) that provides (([Target Audience])) with (([Unique Moat])) in an era where (([Market Trend/Problem])).',
    figmaNode: '131:411',
  },
  {
    id: 'S11', kind: 'question', theme: 'dark', title: 'Brand Perception', label: 'Brand Perception', section: CORE, eyebrow: 'The Scenario', tone: 'muted',
    question: 'What are the exact **three words or phrases** you want to overhear someone using to describe **how you make them feel?**',
    figmaNode: '131:420',
  },

  // ---- Section 2 ----
  { id: 'D02', kind: 'divider', theme: 'gradient', bg: 'bg-align.jpg', title: AUDIENCE, label: AUDIENCE, section: AUDIENCE, figmaNode: '131:173' },
  {
    id: 'S12', kind: 'cards', theme: 'dark', title: 'The Target Persona', label: 'The Target Persona', section: AUDIENCE,
    question: 'Who is the specific buyer we are talking to?',
    cards: [
      { title: 'Job Title / Role', prompt: 'Who actually signs the cheque or pushes the button?' },
      { title: 'The Mindset', prompt: 'What is their current daily reality?' },
    ],
    figmaNode: '131:262',
  },
  {
    id: 'S13', kind: 'cards', theme: 'dark', title: 'Pain Points & Triggers', label: 'Pain Points & Triggers', section: AUDIENCE,
    cards: [
      { title: 'The Pain Point', prompt: 'What is the specific, ugly problem keeping them up at night?' },
      { title: 'The Operational Trigger', prompt: 'What is the exact catalyst or breaking point that forces them to buy your solution today?' },
    ],
    figmaNode: '131:281',
  },
  {
    id: 'S14', kind: 'question', theme: 'dark', title: 'The "Aha!" Moment', label: 'The "Aha!" Moment', section: AUDIENCE, tone: 'muted',
    question: 'At what **exact moment** does the customer realise your product or service is **worth every penny?**',
    sub: "This isn't when they sign the contract; it's when they feel the relief.",
    figmaNode: '131:299',
  },
  {
    id: 'S15', kind: 'question', theme: 'light', title: 'Buyer Journey & Qualification', label: 'Buyer Journey & Qualification', section: AUDIENCE,
    question: 'How do we qualify leads and route them to the right solution?',
    sub: 'What are the entry-level thresholds? (e.g., minimum budgets, company size).\nWhat is the strict path to purchase?',
    figmaNode: '131:309',
  },
  { id: 'S16', kind: 'question', theme: 'light', title: 'The Brand Ecosystem', label: 'The Brand Ecosystem', section: AUDIENCE, question: 'What are the distinct access points, products, or service tiers a client can buy from you?', figmaNode: '131:326' },
  {
    id: 'S17', kind: 'question', theme: 'light', title: 'Routing & Triggers', label: 'Routing & Triggers', section: AUDIENCE,
    question: "What is the exact operational 'Red Flag' or 'Green Light' you listen for that makes you say, 'Stop. You don't need (([Service A])). You need (([Service B])).'?",
    figmaNode: '131:318',
  },
  {
    id: 'S18', kind: 'question', theme: 'dark', title: 'The Conversion Goal', label: 'The Conversion Goal', section: AUDIENCE, tone: 'muted',
    question: 'What is the **absolute #1 action** we want the user to take when they land on your brand?',
    sub: "What is the ultimate goal?\nIf they aren't ready to buy today, how do we capture them?",
    figmaNode: '131:335',
  },
  { id: 'X01', kind: 'break', theme: 'gradient', bg: 'bg-break.jpg', title: 'Break Time', label: 'Break Time', section: '', figmaNode: '131:517' },

  // ---- Section 3 ----
  { id: 'D03', kind: 'divider', theme: 'gradient', bg: 'bg-voice.jpg', title: VOICE, label: VOICE, section: VOICE, figmaNode: '131:181' },
  {
    id: 'S19', kind: 'pyramid', theme: 'dark', title: 'The Messaging Tree', label: 'The Messaging Tree', section: VOICE,
    tiers: [
      { name: 'The Core', prompt: '(Why) What is the one unshakeable truth your brand believes about your industry?' },
      { name: 'The Pillars', prompt: '(How) How do we prove this truth operationally?' },
      { name: 'The Flex', prompt: '(What) How does this core pitch adapt depending on who is in the room?' },
    ],
    question: 'How does our core pitch change depending on who is sitting across the table?',
    figmaNode: '131:244',
  },
  {
    id: 'S20', kind: 'scales', theme: 'dark', title: 'Tone of Voice', label: 'Tone of Voice', section: VOICE,
    scales: [
      ['Formal', 'Informal'],
      ['Understated', 'Bold'],
      ['Enthusiastic', 'Matter of Fact'],
      ['Authoritative', 'Conversational'],
      ['Disruptive', 'Established'],
      ['Descriptive', 'Minimalist'],
      ['Creative', 'Engineered'],
      ['Accessible', 'Premium'],
      ['Community-Led', 'Exclusive'],
    ],
    figmaNode: '131:528',
  },
  {
    id: 'S21', kind: 'choices', theme: 'dark', title: 'Voice Mechanics (The Hard Rules)', label: 'Voice Mechanics', section: VOICE,
    groups: [
      { q: 'How do you refer to your business?', options: ['Third person (they, often using business name)', 'First person (we, generally business name is NOT used)', 'A mixture (refer to business in third person, followed by first person)'] },
      { q: 'Do you talk directly to clients or people in general?', options: ['Address the reader directly (you)', 'To people in general, not really addressing the reader'] },
      { q: 'Do you want to use superlative adjectives to describe your business?', options: ['Yes - "We are the #1 solution," "The best in the market"', 'No - Understated Confidence: Focus on facts ("We optimise output by 40X").'] },
      { q: 'How do you write your titles & headings?', options: ['Title case: How to Write for Your Brand', 'Upper case first letter of each word: How To Write For Your Brand', 'Sentence case: How to write for your brand', 'All uppercase: HOW TO WRITE FOR YOUR BRAND'] },
      { q: 'Do you shorten your words?', options: ["Yes e.g We're delighted to work with you", 'No e.g We are delighted to work with you'] },
      { q: 'Do you use emojis?', options: ['Yes, ALWAYS', 'In blogs and socials, not on main website pages', 'Social media only', 'Never'] },
    ],
    figmaNode: '131:430',
  },
  {
    id: 'S22', kind: 'wordlists', theme: 'light', title: 'Voice Mechanics (Power Words & Forbidden List)', label: 'Voice Mechanics', section: VOICE,
    columns: [
      { title: 'Power Words & Phrases', desc: '(Words we actively use to sound like us).' },
      { title: 'The Forbidden List', desc: '(Words, jargon, and clichés we MUST kill).' },
    ],
    figmaNode: '131:678',
  },
  {
    id: 'S23', kind: 'scenario', theme: 'dark', title: 'Scenario Translation', label: 'Scenario Translation', section: VOICE,
    question: '"Thank you for contacting us.\nWe will send you a proposal soon."',
    sub: 'How would your brand say this?', subLarge: true,
    figmaNode: '131:507',
  },
  {
    id: 'S24', kind: 'question', theme: 'dark', title: 'The Core Hooks', label: 'The Core Hooks', section: VOICE, tone: 'muted',
    question: 'What are the recurring **phrases, taglines, or analogies** you naturally use to explain your impact?',
    figmaNode: '131:345',
  },

  // ---- Section 4 ----
  { id: 'D04', kind: 'divider', theme: 'gradient', bg: 'bg-title.jpg', title: WRAP, label: WRAP, section: WRAP },
  {
    id: 'S25', kind: 'summary', theme: 'gradient', bg: 'bg-summary.jpg', title: 'The Summary', label: 'The Summary', section: '',
    question: 'Do you have any further information you would like to share or have any questions?',
    sub: 'Thank you for your time today.',
    figmaNode: '131:690',
  },
];

/** Layout cloned for bespoke slides: dark, one eyebrow, one question */
export function bespokeSlide(id: string, title: string, question: string, section: string): SlideDef {
  const [label, eyebrow] = title.includes(':') ? title.split(/:\s*/, 2) : [title, undefined];
  return { id, kind: 'question', theme: 'dark', title, label, eyebrow, section, question };
}
