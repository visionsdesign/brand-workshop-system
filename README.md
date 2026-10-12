# Visions Design: Brand DNA Workshop

A live, shareable version of the Brand DNA Workshop. The facilitator drives the slides; the client opens a link and follows along in real time. Answers mostly come from the call recording, so nobody has to type. The tone-of-voice sliders and the voice-mechanics choices can be tapped live, and every slide change is time-stamped so the transcript can be matched to each slide afterwards.

The slides are rebuilt from Dom's Figma master (`dKi1IANLZvTn2ooxYH1o9d`) and keep its layout, type and backgrounds.

## Client portal (paid workshops)

| Page | What it does |
|---|---|
| `/` | Public landing page: Guided or Self-serve, and the code form |
| `/start/<token>` | The client's private workshop page: intake, file uploads, then booking (guided) or the self-serve workshop |
| `/team` | Team dashboard: every workshop, its intake and files, status, Drive folder and notes |
| `/team/codes` | Create access codes for clients who pay by invoice (`VIS-XXXX-XXXX`) |

Team sign-in is an emailed magic link for `@visionsdesign.co.uk` addresses once Supabase is set up. Locally, without Supabase, it is your work email plus the facilitator PIN. A team sign-in also opens every facilitator view without the PIN.

Without Supabase, portal data and uploads are kept in `.data/` on this machine (not in git). With Supabase they live in the `portal_*` tables and the private `workshop-files` storage bucket; uploads go straight from the browser to storage, so large files never pass through Netlify.

**Self-serve workshop** (`/start/<token>/workshop`): every question slide, answered by typing, voice note (audio kept, browser transcript where supported) or tapping, autosaved, then submitted. With `ANTHROPIC_API_KEY` set, each question also offers an AI facilitator (Claude Opus 5.5) that talks the client through it and drafts their answer; the conversation is saved for the team. Limits: 24 messages per question, 400 per workshop. The team sees every answer, voice note and conversation on the workshop page and can download them as markdown for `Capture`.

**Buying online** (`/buy/guided`, `/buy/self-serve`): Stripe Checkout at the prices in `PRICE_GUIDED_PENCE` / `PRICE_SELF_SERVE_PENCE` (plus 20% VAT unless `PRICES_INCLUDE_VAT=true`), with a VAT invoice. The workshop is created on the success page or by the Stripe webhook (`/api/stripe/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`), whichever comes first, never twice.

**Booking** (guided): once steps 1 and 2 are done, the Cal.com event in `CALCOM_LINK` appears in step 3 with the client's details and workshop ID attached. Cal.com's webhook (`/api/calcom/webhook`, signed with `CALCOM_WEBHOOK_SECRET`; triggers Booking created, rescheduled, cancelled) confirms it.

Coming next: Google Drive file listing.

## Links per client

| Who | Link |
|---|---|
| Client | `/w/<link code>` |
| Facilitator | `/w/<link code>/present`, PIN protected |
| Timeline export | `/api/w/<link code>/timeline` (facilitator only, also a button in the facilitator view) |

The link code is set in `clients/<slug>/client.md`, section 3, under "Workshop link code". Make it hard to guess, e.g. `prefera-k7m2q9`.

## Running a workshop

1. Prepare the client folder as usual (`New client:`, then `Prepare:`). See `DESIGN.md`.
2. `npm run content` checks the client files parse. It prints the client link and any warnings.
3. Deploy (push to the Netlify site). The content is rebuilt on every deploy.
4. In the session: open the facilitator view, send the client link, and press **Start recording clock** at the moment you start recording the call.
5. Move with the arrow keys or space. Press **M** to flag a moment worth going back to.
6. Afterwards, **Download timeline** and drop it in `clients/<slug>/sources/` with the call transcript, then run `Capture:`.

## Facilitator view

- Slide list with include / light / skip per slide (click the chip to change it live; client.md sets the defaults).
- Baseline and Ask for the current slide, per entity on multi-entity slides.
- Timers for this slide and its running-order block, against the minutes in client.md.
- "Client brief" tab: objective, housekeeping, recon and what we know.
- Word lists for the Power Words / Forbidden List slide are added here and appear on the client's screen.

## Local development

```bash
npm install
npm run dev
```

Opens on port 3000 (`npm run dev -- -p 3110` for another). Without Supabase the app keeps sessions in memory, which is fine for a dry run on one machine. The local facilitator PIN is `0000`.

## Deploying (Netlify + Supabase)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. In Netlify, set the variables from `.env.example`: `FACILITATOR_PIN`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Build command `npm run build`. Netlify's Next.js runtime handles the rest.

## What is where

| Path | What |
|---|---|
| `src/lib/registry.ts` | The master workshop: every slide's copy and layout type. Change copy here. |
| `src/components/Slide.tsx`, `src/app/slides.css` | Slide rendering on a 1920 × 1080 canvas, measured from Figma |
| `scripts/build-content.mjs` | Reads `clients/*/client.md` and `facilitator-notes.md` into `src/content/generated/` |
| `src/lib/workshop.ts` | Applies a client's skips, bespoke slides and running order to the registry |
| `src/lib/store.ts` | Session storage (Supabase or in-memory) |
| `src/lib/sync.ts` | Live sync: Supabase Realtime broadcast, polling as a fallback |
| `src/lib/timeline.ts` | The timeline export used by `Capture:` |

Facilitator notes are only ever sent to the browser after the PIN check. The client page gets slide copy only.
