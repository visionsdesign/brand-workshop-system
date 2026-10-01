# Brand DNA Workshop System

Read `DESIGN.md` in full before doing anything in this folder. It defines the commands Dan uses (`New client:`, `Prepare:`, `Build:`, `Update:`, `Capture:`, `Template: change`), the slide registry and the rules for writing facilitator notes.

The workshop runs as a Next.js web app (see `README.md`). `src/lib/registry.ts` is the master workshop; `scripts/build-content.mjs` turns each client folder into app content. `template/template-map.md` maps registry slides to the Figma frames they were rebuilt from.
