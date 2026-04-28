# RALPLAN Draft: English Review App MVP

## Status

- Workflow: `$ralplan` consensus planning draft
- Draft file: `.omx/drafts/ralplan-english-review-app-draft.md`
- Requirements source of truth: `.omx/specs/deep-interview-english-review-app.md`
- Context snapshot: `.omx/context/english-review-app-20260428T012219Z.md`
- Decision posture: **no-auto-decisions**. This draft proposes defaults but marks required user-confirmation gates before execution.
- Implementation status: **planning only; no source code changes proposed in this draft**.

## Grounding Sources

### Project requirements

- Deep-interview spec: `.omx/specs/deep-interview-english-review-app.md`
- Context snapshot: `.omx/context/english-review-app-20260428T012219Z.md`

### Official external facts checked for planning

- Next.js installation docs: `create-next-app` recommended defaults include TypeScript, ESLint, Tailwind CSS, App Router, Turbopack, and `@/*` import alias; minimum Node.js version is 20.9. Source: https://nextjs.org/docs/app/getting-started/installation
- Next.js deployment docs: Next.js can deploy as a Node.js server, Docker container, static export, or via adapters; Node.js supports all features, static export is limited, and verified adapters include Vercel. Source: https://nextjs.org/docs/app/getting-started/deploying
- Supabase Next.js SSR guide: install `@supabase/supabase-js` and `@supabase/ssr`; configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; create separate browser/client and server utilities. Source: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase billing docs: Free Plan grants two free projects across organizations where the user is owner/admin. Source: https://supabase.com/docs/guides/platform/billing-on-supabase
- Vercel Hobby docs/pricing: Hobby is free with usage caps and is restricted to personal, non-commercial use. Sources: https://vercel.com/docs/accounts/plans/hobby and https://vercel.com/pricing

## Requirements Summary

Build a greenfield, mobile-first web app for reviewing English academy material. The app is a focused reveal-quiz review tool for sentences, expressions, Korean meanings, grammar/theory notes, and user-provided examples. The MVP must help the user revisit confusing cards, preferably daily, without becoming an AI tutor, exam system, lecture-note app, or desktop-first product.

### MVP in scope

1. Next.js-based mobile-first web app.
2. Supabase-backed persistence, designed to remain free-tier-friendly where possible.
3. Study card CRUD sufficient for entering academy material.
4. Card fields:
   - English expression/sentence
   - Korean meaning
   - Grammar/theory memo
   - User-provided example sentences
   - Known/confusing status
   - Basic timestamps/review metadata
5. Reveal-review flow where at least one part of a card is hidden until tapped/clicked.
6. Per-card known/confusing marking after reveal.
7. Later-session prioritization or filtering for confusing cards.
8. Daily review entry point.

### MVP out of scope

- AI-generated examples, explanations, quizzes, or tutoring.
- Complex exam mode, timers, rankings, advanced scoring, or dashboards.
- Full freeform lecture-note system.
- Desktop-first optimization.
- Voice/pronunciation functionality unless explicitly confirmed as in scope.
- Silent finalization of major decisions.

## RALPLAN-DR Short Summary

### Principles

1. **Mobile-first recall loop over broad note-taking**: optimize the core phone flow for quick daily reveal/review sessions before adding secondary surfaces.
2. **Manual academy-content fidelity**: store user-provided sentences, meanings, grammar notes, and examples; do not generate learning content in MVP.
3. **Free-tier-friendly by default**: keep architecture simple enough for Supabase Free and Vercel Hobby constraints, while documenting usage caps and plan restrictions.
4. **Security decisions must be explicit**: auth, RLS, and ownership rules cannot be silently decided under `no-auto-decisions`.
5. **Testable MVP slices**: every implementation step should produce a verifiable user capability, not just scaffolding.

### Top 3 decision drivers

1. **Fast daily use on phone**: the app should open directly into a useful review action with minimal navigation.
2. **Low operational complexity/cost**: use mainstream Next.js/Supabase defaults and avoid custom infrastructure.
3. **Data ownership and privacy clarity**: even a personal study app stores learning notes and potentially account identifiers, so schema/RLS/auth choices need confirmation.

### Viable options

#### Option A — Recommended proposal: Next.js App Router + Supabase + optional email auth, hosted on Vercel Hobby

Pros:
- Aligns with the user’s preferred stack and current official Next.js defaults.
- Vercel is a verified Next.js deployment adapter and has simple Git-based CI/CD for a greenfield app.
- Supabase SSR utilities support clear browser/server client separation if auth is enabled.
- Easy path from personal MVP to synced multi-device use.

Cons:
- Requires user confirmation on auth and RLS before implementation.
- Vercel Hobby is personal/non-commercial only and usage-capped.
- Supabase project/environment setup is external and credential-gated.

#### Option B — Next.js static-export-style client app + Supabase direct client, hosted on any static host

Pros:
- Potentially very simple hosting model and fewer server runtime concerns.
- Can still use Supabase client-side for a personal app.
- Avoids Next.js server feature dependence.

Cons:
- Static export has limited Next.js feature support; SSR/auth/cookie patterns become constrained.
- Security posture is more sensitive if no server layer is used.
- Less aligned with official Supabase SSR guidance for Next.js auth.

#### Option C — Local-only browser storage MVP first, Supabase later

Invalidation rationale for this project:
- It could reduce setup friction, but it conflicts with the explicit requirement for a Supabase-backed setup and likely multi-device value.
- It would defer the core data/security decisions that the user specifically wants planned now.
- Keep only as a fallback if the user rejects Supabase setup during confirmation.

## Recommended Plan Direction

Proceed with **Option A as the planning recommendation**, but do not treat it as approved until the user confirms the gates below. Scaffold with Next.js recommended defaults, use Supabase for persistence, design a minimal card/review schema, and keep UI mobile-first with a small route surface.

## Required User-Confirmation Gates (`no-auto-decisions`)

These must be confirmed before `$ralph` or `$team` execution begins:

1. **Auth vs single-user flow**
   - Proposed default: implement Supabase Auth with email/password or magic-link, because hosted Supabase persistence plus a phone-first web app implies private, durable learning data.
   - Auth-enabled hosted track: use `owner_id`, owner-scoped RLS, and Vercel Hobby only if the app remains personal/non-commercial.
   - Private single-user track: allowed only for constrained local/private testing or a clearly access-controlled private deployment; **do not publicly host a Supabase-backed no-auth app without a safe access-control model**.
   - Confirmation required: choose auth-enabled hosted MVP or constrained private single-user MVP.

2. **Supabase RLS/schema**
   - Proposed default confirmable schema:
     - `study_cards`: `id uuid primary key`, `owner_id uuid references auth.users(id)`, `english_text text not null`, `korean_meaning text not null`, `grammar_note text not null`, `status text check (status in ('new','known','confusing')) default 'new'`, `last_reviewed_at timestamptz`, `review_count int default 0`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
     - `card_examples`: `id uuid primary key`, `card_id uuid references study_cards(id) on delete cascade`, `example_text text not null`, `sort_order int default 0`, `created_at timestamptz default now()`.
   - Why separate `card_examples` over JSON examples: easier add/edit/reorder/delete behavior, clearer validation, and cleaner future expansion while staying simple.
   - Auth-enabled RLS proposal: enable RLS; `study_cards.owner_id = auth.uid()` for select/insert/update/delete; `card_examples` access allowed only through cards owned by `auth.uid()`.
   - Private single-user proposal: schema may omit `owner_id` only if deployment is not publicly reachable or is protected by another access-control layer; otherwise auth/RLS is required before deployment.
   - Confirmation required: approve this schema/RLS baseline or revise it before execution.

3. **Hosting target**
   - Proposed default: Vercel Hobby for personal/non-commercial MVP, acknowledging usage caps.
   - Alternative: Node server deployment elsewhere or static export if server features are avoided.
   - Confirmation required: approve Vercel Hobby or select another deployment target.

4. **Review scheduling rule**
   - Proposed default: daily review queue prioritizes `confusing` cards first, then least-recently-reviewed cards, with a small configurable daily count.
   - Alternative: no daily count; show all confusing cards plus manual browse.
   - Confirmation required: choose the initial scheduling rule and whether to set a daily card count.

5. **Voice/pronunciation deferral**
   - Proposed default: explicitly defer voice/pronunciation features from MVP.
   - Alternative: mark as absent entirely until a later product phase.
   - Confirmation required: confirm deferral/absence wording.

## Testable Acceptance Criteria

1. On a phone-sized viewport, the user can open the app and reach the daily review flow without desktop-only layout assumptions.
2. The user can create a study card with English expression/sentence, Korean meaning, grammar/theory memo, and at least one user-provided example sentence.
3. The user can edit and delete an existing study card.
4. The user can start a reveal review where at least one part of the card is hidden before reveal.
5. The user can reveal hidden content with a tap/click.
6. After reveal, the user can mark the card as known or confusing.
7. Known/confusing state and review timestamps persist in Supabase.
8. Confusing cards are findable and/or prioritized in a later review session.
9. The daily entry point presents a clear next-review action, even with zero cards or no confusing cards.
10. Empty, loading, and error states are understandable on mobile.
11. The app includes no AI-generated learning content in MVP.
12. The app includes no exam timers, rankings, or advanced scoring dashboards in MVP.
13. Lint, typecheck, build, and relevant tests pass before execution is declared complete.
14. Deployment documentation identifies the chosen free-tier-friendly path and required environment variables without committing secrets.
15. If auth is selected, RLS tests or documented Supabase policy checks demonstrate users can only access their own cards.

## Proposed Implementation Steps

### Phase 0 — Confirmation and canonical planning artifacts

1. Convert this draft into canonical `.omx/plans/` PRD and test spec artifacts after user review.
2. Resolve the five required confirmation gates.
3. Lock MVP scope and execution lane (`$ralph` for single-owner loop or `$team` for parallel lanes).

Acceptance evidence:
- `.omx/plans/prd-english-review-app.md` exists.
- `.omx/plans/test-spec-english-review-app.md` exists.
- Confirmation decisions are recorded in the PRD/ADR.

### Phase 1 — Greenfield scaffold and quality baseline

1. Scaffold a Next.js App Router app with TypeScript, Tailwind, ESLint, Turbopack defaults, and Node 20.9+ requirement.
2. Establish scripts for dev/build/lint/typecheck/test.
3. Add baseline test tooling appropriate for the selected implementation lane.

Acceptance evidence:
- App starts locally.
- Lint/typecheck/build scripts run.
- Initial smoke test passes.

### Phase 2 — Supabase integration and data model

1. Add Supabase packages and separate browser/server utilities using official env var names.
2. Define schema/migration documentation for cards, examples, statuses, timestamps, and optional owner relationship.
3. Implement RLS policies if auth is selected.
4. Provide `.env.example` without secrets.

Acceptance evidence:
- Supabase client utilities exist and are used consistently.
- Data access path works against configured project or mocked test boundary.
- RLS/schema checks match the confirmed security model.

### Phase 3 — Card creation/editing workflow

1. Implement mobile-first card list and creation/editing form.
2. Validate required fields and support at least one user-provided example.
3. Add empty/loading/error states.

Acceptance evidence:
- User can create, edit, delete, and view study cards on a phone viewport.
- Validation prevents unusable empty cards.
- Persistence survives refresh.

### Phase 4 — Reveal-review workflow

1. Implement daily review entry point.
2. Implement review queue using confirmed scheduling rule.
3. Hide selected card information until reveal.
4. Allow known/confusing marking after reveal.

Acceptance evidence:
- Review starts with eligible cards.
- Reveal is a deliberate tap/click action.
- Marking updates status and review metadata.
- Confusing cards reappear or sort ahead according to the confirmed rule.

### Phase 5 — Polish, deployment readiness, and verification

1. Tighten mobile spacing, touch targets, and navigation.
2. Add route-level and component-level regression coverage for core flows.
3. Document setup/deployment using chosen hosting target and Supabase environment variables.
4. Run full verification and fix regressions.

Acceptance evidence:
- Mobile viewport checks pass.
- Test/build/lint/typecheck pass.
- Deployment instructions are complete enough for a user to configure secrets externally.

## Risks and Mitigations

1. **Auth/RLS ambiguity could create insecure defaults**
   - Mitigation: block execution on explicit auth/RLS confirmation; default recommendation is auth-enabled owner-scoped RLS for hosted Supabase. If auth is rejected, public deployment remains blocked until an alternate safe access-control model is confirmed.

2. **MVP could drift into AI tutor or exam app**
   - Mitigation: keep AI generation, timers, rankings, and advanced dashboards out of scope; add tests/checklist items for absence of these features.

3. **Review scheduling could become overcomplicated**
   - Mitigation: start with simple confusing-first / least-recently-reviewed logic; defer full spaced repetition.

4. **Free-tier assumptions may be exceeded or unsuitable**
   - Mitigation: document Vercel Hobby personal/non-commercial restriction and usage caps; keep architecture portable to Node server deployment.

5. **Supabase credentials/setup are external blockers**
   - Mitigation: provide `.env.example`, setup docs, and tests/mocks where possible; do not commit secrets.

6. **Mobile UX may be treated as responsive afterthought**
   - Mitigation: define phone viewport acceptance checks and assign a UI/mobile lane in team execution.

## Verification Steps

### Local/static verification

- `node --version` confirms Node 20.9+ before app work.
- `npm run lint` or package-manager equivalent passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.

### Functional verification

- Create a card with all required learning fields.
- Refresh and confirm persisted card data.
- Edit/delete a card.
- Start daily review on mobile viewport.
- Reveal hidden content.
- Mark known/confusing and verify persisted status.
- Confirm confusing cards are prioritized/found later.

### Security/data verification

- If auth is selected, verify unauthenticated users cannot read/write card data.
- If auth is selected, verify user A cannot access user B rows via RLS.
- If auth is not selected, verify the plan explicitly forbids public hosted Supabase access unless another access-control layer is confirmed; deployment docs must label this as private/local-only or blocked for public deployment.
- Confirm environment variables are documented but secrets are not committed.

### Deployment verification

- Confirm selected hosting target builds successfully.
- Confirm Supabase environment variables are configured in the hosting provider.
- Smoke-test deployed app on a phone-sized viewport.

## ADR: English Review App MVP Architecture

### Decision

Recommend a mobile-first Next.js App Router MVP using official create-next-app defaults, Tailwind for styling, Supabase for persistence/auth-ready data access, and Vercel Hobby as the proposed personal/non-commercial deployment target. Final execution remains gated on user confirmation for auth, schema/RLS, hosting, review scheduling, and voice/pronunciation deferral.

### Drivers

- The requirements source of truth specifies Next.js + Supabase and mobile-first daily review.
- The user wants free-hosting-friendly choices and no major silent decisions.
- The MVP needs durable persistence for English expressions, Korean meanings, grammar notes, examples, and review status.
- Official docs support this stack with current defaults and clear Supabase SSR patterns.

### Alternatives considered

1. **Recommended: Next.js App Router + Supabase + Vercel Hobby**
   - Best alignment with requirements and official defaults.
   - Requires confirmation for auth/RLS/hosting.

2. **Static export + Supabase direct client**
   - Simpler hosting but limited Next.js feature support and more constrained auth/security model.

3. **Local-only browser storage first**
   - Lowest setup burden but conflicts with Supabase-backed direction and would postpone important decisions.

### Why chosen

Option A provides the cleanest route to a practical personal MVP: fast mobile UI iteration, durable cloud persistence, and low-cost deployment. It preserves future flexibility while avoiding unnecessary custom infrastructure.

### Consequences

- Execution must include Supabase setup and environment-variable handling.
- Auth/RLS choices materially affect implementation and tests; public hosted Supabase access must not proceed without owner-scoped RLS or another confirmed access-control model.
- Vercel Hobby is only appropriate if the use remains personal/non-commercial and within usage caps.
- The app should not depend on advanced Next.js features unless the hosting target supports them.

### Follow-ups

1. Confirm all five `no-auto-decisions` gates.
2. Create PRD and Test Spec artifacts under `.omx/plans/`.
3. Choose `$ralph` or `$team` execution path.
4. Capture final schema/RLS policies in the PRD/ADR before implementation.
5. Revisit voice/pronunciation, AI assistance, spaced repetition, and analytics only after MVP validation.

## PRD and Test Spec Artifact Recommendations

Create these after this draft is accepted or revised:

1. `.omx/plans/prd-english-review-app.md`
   - Product goal and non-goals.
   - User stories for card creation, daily reveal review, known/confusing marking, and confusing-card revisit.
   - Confirmed decisions for auth, schema/RLS, hosting, scheduling, and voice/pronunciation.
   - Data model summary and route map.
   - MVP release checklist.

2. `.omx/plans/test-spec-english-review-app.md`
   - Acceptance criteria mapped to tests.
   - Unit tests for review scheduling and validation.
   - Integration tests for card CRUD and status persistence.
   - UI/e2e tests for mobile reveal-review flow.
   - Security/RLS verification if auth is selected.
   - Deployment smoke test checklist.

## Available Agent Types Roster

Use only known available agent types for follow-up execution and verification:

- `explore` — fast codebase search and file/symbol mapping.
- `analyst` — requirements clarity and hidden constraints.
- `planner` — sequencing, plans, risk flags.
- `architect` — architecture, boundaries, interfaces, tradeoffs.
- `debugger` — root-cause analysis and regression isolation.
- `executor` — implementation, refactoring, feature work.
- `team-executor` — supervised team execution for conservative delivery lanes.
- `verifier` — completion evidence and test adequacy.
- `style-reviewer` — formatting, naming, idioms, lint conventions.
- `quality-reviewer` — logic defects and maintainability.
- `api-reviewer` — API contracts and backward compatibility.
- `security-reviewer` — auth/RLS/security boundaries.
- `performance-reviewer` — performance and complexity.
- `code-reviewer` — comprehensive review.
- `dependency-expert` — dependency/package evaluation.
- `test-engineer` — test strategy and coverage.
- `quality-strategist` — release readiness and quality strategy.
- `build-fixer` — build/toolchain/type failures.
- `designer` — UX/UI architecture and interaction design.
- `writer` — documentation and migration notes.
- `qa-tester` — interactive CLI/service runtime validation.
- `git-master` — commit strategy and history hygiene.
- `code-simplifier` — simplification of changed code without behavior changes.
- `researcher` — official documentation and reference research.
- `product-manager` — product framing and PRDs.
- `ux-researcher` — usability/accessibility audits.
- `information-architect` — taxonomy and navigation.
- `product-analyst` — product metrics and experiments.
- `critic` — plan/design challenge and review.
- `vision` — image/screenshot/diagram analysis.

## Follow-up Staffing Guidance

### `$ralph` path: recommended for tightly controlled MVP execution

Use `$ralph` after the PRD and Test Spec exist and the confirmation gates are resolved.

Suggested lanes within Ralph:

1. **Implementation lane — `executor`, reasoning: medium**
   - Scaffold app, Supabase utilities, card CRUD, and review flow.
2. **Test/evidence lane — `test-engineer` or `verifier`, reasoning: medium/high**
   - Build tests for scheduling, persistence, and mobile review acceptance criteria.
3. **Security lane — `security-reviewer`, reasoning: medium**
   - Required if auth/RLS is selected; review policies and data boundaries.
4. **UX lane — `designer` or `ux-researcher`, reasoning: medium/high**
   - Validate mobile-first flow, touch targets, empty states, and reveal interaction.
5. **Final sign-off lane — `architect` then `critic`/`verifier`, reasoning: high**
   - Confirm architecture matches PRD and evidence supports completion.

Concrete launch hint after gates are resolved:

```bash
$ralph --prd "Build the English review app MVP from .omx/plans/prd-english-review-app.md and .omx/plans/test-spec-english-review-app.md. Use Next.js + Supabase. Do not add AI generation, exam timers, rankings, or voice/pronunciation features. Verify lint, typecheck, tests, build, mobile review flow, persistence, and confirmed RLS/auth behavior."
```

### `$team` path: recommended if parallel UI/data/test lanes are desired

Recommended headcount: **4 workers** with `executor` as the shared launch role, plus leader-directed specialist review. Since current `omx team N:agent-type` selects one worker role prompt for all workers, use `4:executor` and assign lane responsibilities in the task text.

Suggested team lanes:

1. **Worker 1 — App scaffold/data integration, role: `executor`, reasoning: medium**
   - Next.js scaffold, Supabase packages/utilities, env example.
2. **Worker 2 — Product flows/UI, role: `executor` with designer guidance, reasoning: medium**
   - Mobile card CRUD and reveal-review UI.
3. **Worker 3 — Tests/verification, role: `executor` with test-engineer responsibilities, reasoning: medium**
   - Unit/integration/e2e tests and acceptance evidence.
4. **Worker 4 — Security/docs/deployment, role: `executor` with security/writer responsibilities, reasoning: medium**
   - RLS/auth checks, setup docs, deployment docs.

Concrete launch hint after gates are resolved:

```bash
omx team 4:executor "Build the English review app MVP from .omx/plans/prd-english-review-app.md and .omx/plans/test-spec-english-review-app.md. Split lanes: (1) Next.js/Supabase scaffold and data utilities, (2) mobile card CRUD and reveal-review UI, (3) tests and verification evidence, (4) auth/RLS/security plus deployment docs. Preserve no-AI/no-exam/no-voice MVP scope. Run lint, typecheck, tests, build, mobile smoke checks, persistence checks, and RLS checks if auth is selected before shutdown."
```

Equivalent workflow-surface hint:

```text
$team 4:executor "Build the English review app MVP from .omx/plans/prd-english-review-app.md and .omx/plans/test-spec-english-review-app.md with the four lanes described in the approved plan."
```

### Team verification path

1. Leader verifies team startup and worker ACKs via `omx team status <team-name>` and mailbox/state files.
2. Keep one worker or leader lane responsible for evidence aggregation.
3. Before shutdown, require:
   - pending tasks = 0
   - in-progress tasks = 0
   - failed tasks = 0, or explicitly accepted failure path
   - lint/typecheck/tests/build evidence captured
   - mobile acceptance checks captured
   - persistence checks captured
   - auth/RLS checks captured if selected
4. Run `omx team shutdown <team-name>` only after terminal task state.
5. Use `verifier` or `architect` sign-off after integration if team changes are broad.

## Consensus Review Checklist for Architect/Critic

- Does the plan preserve the deep-interview spec as source of truth?
- Are all `no-auto-decisions` gates explicit and unimplemented until confirmed?
- Is Option A fairly compared against viable alternatives?
- Are acceptance criteria testable on mobile?
- Is Supabase auth/RLS risk handled before code execution?
- Are free-tier constraints represented accurately and not overpromised?
- Are PRD and Test Spec recommendations sufficient for Ralph startup gates?
- Are `$ralph` and `$team` follow-up paths concrete enough to execute?

## Revision Changelog

- Iteration 1 architect feedback applied: clarified no-auth/single-user security path, made the proposed Supabase schema confirmable, and added explicit verification expectations for auth-disabled deployments.
