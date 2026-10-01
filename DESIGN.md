# Visions Design: Brand DNA Workshop System

Instructions for Claude Code. This repo runs Visions Design's Brand DNA Workshop as a live web app. One master workshop, a folder per client, and a shareable link per session: the client follows the facilitator's slides in real time while the facilitator sees notes, timings and live answers.

Read this whole file before doing anything. Then read the client folder you've been asked to work on.

---

## 1. What this system does

One master workshop, many client sessions.

1. **The master workshop** lives in code: `src/lib/registry.ts` holds every slide's copy and layout, rebuilt from Dom's Figma template (file `dKi1IANLZvTn2ooxYH1o9d`). It is never edited for a client.
2. **Each client** gets a folder in `clients/<client-slug>/` holding their intake (`client.md`), their raw source material (`sources/`), their facilitator notes (`facilitator-notes.md`) and, after the session, `workshop-answers.md`.
3. **Each session** is a link. `npm run content` (also run automatically by `dev` and `build`) reads every client folder and the app serves:
   - `/w/<link code>`: the client view. Follows the facilitator's slide, full screen. The client can tap the Tone of Voice sliders and the Voice Mechanics choices; nothing needs typing.
   - `/w/<link code>/present`: the facilitator view, behind the `FACILITATOR_PIN`. Notes, timers, slide list with live skip/light toggles, word lists, flag-a-moment and the timeline export.

The session is recorded on the call. The app time-stamps every slide change against a "recording clock" so the transcript can be lined up slide by slide at `Capture`.

```
brand-workshop-system/
├── DESIGN.md                      ← this file
├── README.md                      ← running, deploying, where things live
├── template/template-map.md       ← Figma node IDs for every registry slide (reference)
├── src/lib/registry.ts            ← the master workshop
├── scripts/build-content.mjs      ← client.md + facilitator-notes.md → app content
└── clients/
    ├── _template/client.md        ← blank intake, copied for every new client
    └── prefera/
        ├── client.md
        ├── facilitator-notes.md
        └── sources/
```

---

## 2. Commands

Dan will type one of these. Each maps to a workflow below.

| Command | What happens |
|---|---|
| `New client: <Name>` | Copy `clients/_template/` to `clients/<slug>/`, then interview Dan to fill `client.md` (one question at a time, skip anything already in `sources/`). Generate a hard-to-guess workshop link code (`<slug>-<6 random chars>`). |
| `Prepare: <Name>` | Read `client.md` and everything in `sources/`. Write `facilitator-notes.md` following Section 6. |
| `Build: <Name>` | Run `npm run content`, fix anything it warns about, and report the client and facilitator links. Section 7. |
| `Update: <Name>` | Re-run Prepare and/or Build for changed inputs only. |
| `Capture: <Name>` | After the workshop: read the timeline export and call transcript in `sources/`, write `workshop-answers.md`. Section 8. |
| `Template: change` | Change the master workshop in `src/lib/registry.ts` (copy, new standard slide). Keep IDs stable, update Section 5 and `template/template-map.md`. |

---

## 3. Hosting and access

- **Stack:** Next.js on Netlify, Supabase for session state (slide position, taps, timeline). Setup in `README.md`.
- **Client link:** `/w/<link code>`, where the code comes from `client.md` section 3. Codes must be unique and not guessable; the build warns about duplicates or a missing code.
- **Facilitator link:** `/w/<link code>/present`. One PIN (`FACILITATOR_PIN`) for all workshops. Never send this link to a client.
- **Notes never reach the client.** The client page only receives slide copy. Baselines, Steering Prompts, slide-config reasons and timings are served only after the PIN check. Still write notes client-safe, in case a screen is shared by mistake.
- **Screen sharing:** if Dan shares his screen instead of the client opening the link, share the client view tab, never the facilitator view.

---

## 4. Design rules for the slides

The master is Dom's design, rebuilt 1:1 from Figma on a 1920 × 1080 canvas (`src/app/slides.css`). Claude Code is an operator here, not a designer.

1. **Inherit everything.** Fonts (Helvetica Neue, Inter Light fallback), colours, grid, spacing, layouts and backgrounds come from the template. Never restyle or re-theme a slide for a client.
2. **Client branding is light-touch.** Client name on the title slide (and the Arabic name under it if supplied), `{{BRAND}}` inside on-slide questions. The workshop stays in Visions Design branding. Never introduce the client's colours.
3. **Text fits or it gets shorter.** Bespoke slide questions must fit the 90px question style in three lines or fewer (about 25 words). Shorten the copy, never shrink the type.
4. **Bilingual clients.** Show the Arabic / other-script name only if Dan has supplied it. Never machine-translate brand names or the client's own lines.
5. **Bespoke slides** use the generic dark question layout: label and eyebrow from the title (`Label: Eyebrow`), one question, nothing else.
6. **Skipped slides** stay in the workshop and can be brought back live from the facilitator view.

### Placeholders

| Placeholder | Source in `client.md` |
|---|---|
| Client name (title slide) | Client name, section 1, text before any bracketed aside |
| Arabic / other-script name | Section 1; ignored if it says `[DATA REQUIRED]` |
| `{{BRAND}}` in slide copy | Same as client name |
| Date (title slide header) | Section 3 date, written `Friday 2 October 2026` |
| Workshop objective (agenda slide) | The Workshop Objective line from `facilitator-notes.md` |
| Agenda rows | Section 7 running order, minus the welcome block |

---

## 5. Slide registry

The standard workshop is 32 slides: title, agenda, four section dividers, 24 question slides (S01 to S24), a break and the summary (S25). Registry IDs are stable; `template-map.md` maps each ID to its Figma frame.

| ID | Section | Slide | Question on slide | Notes? |
|---|---|---|---|---|
| S00 | Opening | Title | Client name | No |
| A01 | Opening | Workshop Agenda | Workshop objective + running order | Objective only |
| D01 | Divider | Section 1: The Core DNA | | No |
| S01 | Core DNA | The Spark ("Your Journey") | What was the exact moment or frustration that made you say, "This industry is broken, and we have to fix it"? | Yes |
| S02 | Core DNA | The Breakup | Write a breakup letter from one of your clients to your biggest competitor. Why are they leaving them for you? | Yes |
| S03 | Core DNA | The Paradigm Shift | What is the specific industry friction, outdated norm, or manual pain point your brand is actively destroying? The Old Way vs The New Reality. | Yes |
| S04 | Core DNA | Vision & Ambition: The 5 Year Horizon | Where is this brand going? | Yes |
| S05 | Core DNA | Vision & Ambition: The Internal Mandate | What is the strict operational directive your team executes every single day? | Yes |
| S06 | Core DNA | Vision & Ambition: The External Pitch | If you had to explain what you do to a prospect in one sentence, what is it? | Yes, formula |
| S07 | Core DNA | Core Beliefs: The Non-Negotiables | What are the 4-5 non-negotiable operational standards that dictate your internal culture and speed? | Yes |
| S08 | Core DNA | The Scaling Mantra | When you scale from 50 to 500 employees across three continents, what must remain absolutely constant about how your team operates daily? | Yes |
| S09 | Core DNA | The Moat & The Pillars | What is your unfair structural advantage? | Yes |
| S10 | Core DNA | The Onlyness Statement | `{{BRAND}}` is the ONLY [Category] that provides [Target Audience] with [Unique Moat] in an era where [Market Trend/Problem]. | Yes, formula |
| S11 | Core DNA | Brand Perception ("The Scenario") | What are the exact three words or phrases you want to overhear someone using to describe how you make them feel? | Yes |
| D02 | Divider | Section 2: Alignment & Audience | | No |
| S12 | Audience | The Target Persona | Who is the specific buyer we are talking to? (Job Title / Role, The Mindset) | Yes, per entity |
| S13 | Audience | Pain Points & Triggers | The Pain Point / The Operational Trigger. | Yes, per entity |
| S14 | Audience | The "Aha!" Moment | At what exact moment does the customer realise your product or service is worth every penny? | Yes, per entity |
| S15 | Audience | Buyer Journey & Qualification | How do we qualify leads and route them to the right solution? What are the entry-level thresholds? What is the strict path to purchase? | Yes |
| S16 | Audience | The Brand Ecosystem | What are the distinct access points, products, or service tiers a client can buy from you? | Yes, per entity |
| S17 | Audience | Routing & Triggers | What is the exact operational 'Red Flag' or 'Green Light' you listen for that makes you say, "Stop. You don't need Service A. You need Service B"? | Yes, per entity |
| S18 | Audience | The Conversion Goal | What is the absolute #1 action we want the user to take when they land on your brand? If they aren't ready to buy today, how do we capture them? | Yes |
| X01 | Break | Break Time | Time for a break! | No |
| D03 | Divider | Section 3: Narrative & Voice | | No |
| S19 | Voice | The Messaging Tree | The Core (Why) / The Pillars (How) / The Flex (What). | Yes |
| S20 | Voice | Tone of Voice | Nine sliding scales: Formal/Informal, Understated/Bold, Enthusiastic/Matter of Fact, Authoritative/Conversational, Disruptive/Established, Descriptive/Minimalist, Creative/Engineered, Accessible/Premium, Community-Led/Exclusive. | Yes |
| S21 | Voice | Voice Mechanics (The Hard Rules) | Third/first person, direct address, superlatives, title/sentence/upper case, contractions, emoji use. | Yes |
| S22 | Voice | Voice Mechanics (Power Words & Forbidden List) | Power Words & Phrases / The Forbidden List. | Yes |
| S23 | Voice | Scenario Translation | "Thank you for contacting us. We will send you a proposal soon." How would your brand say this? | Yes |
| S24 | Voice | The Core Hooks | What are the recurring phrases, taglines, or analogies you naturally use to explain your impact? | Yes |
| D04 | Divider | Section 4: Wrap-Up | | No |
| S25 | Wrap-Up | The Summary | Do you have any further information you would like to share or have any questions? | Yes |

**Bespoke slides** get IDs `B01`, `B02`… and a position (`after: S11`) in `client.md`.

---

## 6. Writing facilitator notes (`Prepare`)

This follows Visions Design's `pre-dna-workshop-builder` method. If that skill is installed, use it as the source of truth; these rules are the summary.

### Output file structure

`facilitator-notes.md` contains, in this order:

1. `## Recon matrix`: Data Depth, Multi-Entity Check, Complexity & Stage Read, Existing Voice Signals, Suggested Bespoke Additions.
2. `## Workshop Objective`: one line, client-facing, no brackets.
3. One block per slide in registry order, headed `### S01 The Spark ("Your Journey")`, each containing `Baseline:` and `Steering Prompt:`.
4. `## Bespoke slides` (if any), same format.
5. `## Housekeeping`: anything to confirm before or during the session.

### The rules

1. **Baseline** = what we already know, written with conviction so it can be voiced as a trial hypothesis ("Based on what you've shared, it sounds like…").
2. **Steering Prompt** = the exact sentence the facilitator reads aloud. Never "ask them about X". It cites a real fact ("You mentioned…") and ends with an open validation question.
3. **Second person.** Speak to the client as "you". Addressing a named person directly ("Nouf, as a lawyer…") is fine. Describing them in third person ("Nouf says…") is not.
4. **Formula slides (S06, S10):** Baseline keeps square brackets around each filled variable. Each bracket is six words maximum and names one thing: zoom out to a category instead of listing features. Count the words. Steering Prompt has no brackets.
5. **Workshop Objective:** `Our objective today is to extract the strategic DNA of [Client], [framing].` Use "transitioning your brand from X into Y" for established brands, "establishing your brand's foundation as X, from day one" for new ventures. Must agree with S03 and S04.
6. **Zero hallucination.** No supporting data → Baseline is `[DATA REQUIRED]`, but the Steering Prompt is still a real, specific question that extracts it live. Strategic deduction from partial signal is allowed and expected.
7. **Anti-generic test.** If a Baseline or Steering Prompt could be pasted into a competitor's notes unnoticed, rewrite it around something only this client said.
8. **Multi-entity.** If the client has more than one distinct persona, product or sub-brand, slides S12, S13, S14, S16 and S17 get a fully worked Baseline and Steering Prompt per entity, labelled.
9. **No AI tells.** No em dashes. No "arguably", "it's worth noting", "in today's fast-paced world". Vary sentence rhythm.
10. **Spelling.** British English by default. If the client's own material heavily uses American spelling, match the client.
11. **Brand name integrity.** Spell the brand exactly as the client does, everywhere.
12. **Clean text.** No markdown (asterisks, bold) inside Baseline or Steering Prompt text; it is shown as plain text in the facilitator view.
13. **Complete.** Every registry slide gets a block, even skipped ones (Dan may bring them back live).

### QA before saving

Run the checks silently: anti-generic, bracket word count, second person, no em dashes, registry order, multi-entity applied, every `[DATA REQUIRED]` has a real prompt, brand spelling, no markdown in payload, every prompt readable aloud as-is, objective consistent with S03/S04.

---

## 7. Building the client workshop (`Build`)

1. Read `client.md` and `facilitator-notes.md`. Stop and ask if the workshop link code is missing (generate one and confirm it with Dan).
2. Run `npm run content`. It must print the client with its link and no warnings. Fix the input files for any warning; don't change the parser to hide one.
3. Check the slide configuration came through: start `npm run dev`, open `/w/<code>/present` (local PIN `0000`) and confirm skipped / light slides, bespoke slides in the right place, the agenda rows and the objective.
4. Check the slides with the most client copy: S00 title, A01 agenda, every bespoke slide, S10. Bespoke questions must fit (Section 4, rule 3).
5. Report back to Dan: client link, facilitator link, slides skipped or light, bespoke slides added, any `[DATA REQUIRED]` slides, and housekeeping to clear before the session. Remind him the links only work once the change is deployed.

---

## 8. After the workshop (`Capture`)

Inputs in `clients/<slug>/sources/`:

- `<slug>-workshop-timeline.md`: downloaded from the facilitator view. Slide-by-slide times from the recording clock, flagged moments, time per slide, and the answers tapped live (tone of voice positions, voice mechanics choices, power and forbidden words).
- The call transcript (Teams / Gemini notes or similar).

Write `workshop-answers.md` in registry order: for each slide, the confirmed answer, quoting the transcript at the times the timeline gives for that slide, and what changed from the Baseline. Tapped answers are facts; transcript answers are quotes; anything unclear is flagged, not guessed. Flagged moments get extra attention. This becomes the input for the Brand DNA Master Playbook (`brand-dna-architect`).

---

## 9. Adding a new client: checklist for Dan

1. `New client: <Name>`, answer the intake questions.
2. Drop transcripts, briefs, questionnaires and screenshots into `clients/<slug>/sources/`.
3. `Prepare: <Name>`, review `facilitator-notes.md`, edit anything that doesn't sound right.
4. `Build: <Name>`, then deploy.
5. On the day: open the facilitator link, send the client link, press **Start recording clock** when the recording starts.
6. Afterwards: **Download timeline**, add it and the transcript to `sources/`, then `Capture: <Name>`.
