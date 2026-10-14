# Maintaining this case study

This folder is designed to grow with SoiréeSource without turning the main case study into a release log.

## Folder responsibilities

- `README.md` is the polished portfolio/client-facing narrative. Update it only when a milestone materially changes the story, outcome, architecture, or roadmap.
- `TIMELINE.md` is the evidence-backed development history. Add milestones supported by Git or another durable project record.
- `UPDATES.md` is the ongoing log for UAT findings, releases, integrations, and measured results.
- `assets/` contains the current approved screenshots used by the narrative.
- `scripts/capture-screenshots.ts` refreshes the screenshots from an already-running local application using fictional demo accounts. It does not submit marketplace management or transaction forms.

## Update checklist

1. Pull or inspect the latest `main` history and identify the commits that belong to one coherent milestone.
2. Add a dated entry to `UPDATES.md` with the user/client signal, implementation, evidence, result, and next step.
3. Add a concise entry to `TIMELINE.md` when the milestone is supported by a merged commit or another stable record.
4. Update `README.md` only if the milestone changes the core problem, approach, measurable outcome, current status, limitations, or roadmap.
5. Refresh screenshots when a visible workflow or brand treatment changes.
6. Recheck every number against a committed report or a reproducible benchmark.
7. Keep simulations and production integrations clearly separated.
8. Before public publication, remove client-confidential material and confirm that the client permits the project name, screenshots, operational details, and repository link to be shared.

## Refreshing screenshots

Start the application against the intended demo database:

```powershell
npm run dev
```

In another terminal, run:

```powershell
npx tsx documentation/case-study/scripts/capture-screenshots.ts
```

Optional environment variables:

- `CASE_STUDY_ORIGIN` changes the default `http://127.0.0.1:3000` origin.
- `CASE_STUDY_DEMO_PASSWORD` overrides the documented local demo password.
- `PLAYWRIGHT_CHROMIUM_PATH` selects a Chromium-compatible browser executable.

The script signs in only to seeded fictional accounts and captures existing pages. It does not register users, request bookings, submit payments, resolve disputes, or change settings. Signing in creates normal session records, and authenticated page visits may run the application's idempotent reminder generation.

## Evidence rules

- Say “the available Git history begins…” when discussing 5 October 2026; the initial commit already contains a large Phase 1 implementation and therefore does not prove all development began that day.
- Describe benchmark results as results from the recorded production-shaped local benchmark against the configured remote database.
- Do not describe simulated checkout, escrow, subscriptions, promotions, refunds, or earnings as real financial integrations.
- Do not claim formal accessibility compliance or certification based only on the existing checks.
- Distinguish a successful build/deployment from confirmed public accessibility.
- Prefer exact dates and commit links over phrases such as “recently.”

## Publication checklist

Before publishing the case study outside the project:

- confirm the client has approved public use of the project name and interface;
- verify the production URL and do not expose protected preview URLs;
- confirm all visible accounts, businesses, reviews, bookings, and amounts are fictional demo data;
- remove credentials even when they are demo-only;
- review screenshots for personal data, internal identifiers, or browser/debug chrome;
- decide whether the GitHub repository link should remain public; and
- update the “current stage” and roadmap language so it reflects the actual release state.
