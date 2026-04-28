# PRD: English Review App MVP

## Status

- Workflow: `$ralplan` consensus-approved plan
- Requirements source: `.omx/specs/deep-interview-english-review-app.md`
- Context snapshot: `.omx/context/english-review-app-20260428T012219Z.md`
- Transcript: `.omx/interviews/english-review-app-20260428T012219Z.md`
- Consensus draft: `.omx/drafts/ralplan-english-review-app-draft.md`
- Final planner/architect/critic status: Architect `ITERATE` → revised; Critic `APPROVE`
- Implementation status: **not started**
- Decision posture: **no-auto-decisions** — all MVP decision gates are now resolved by user confirmation.

## Product Goal

Build a mobile-first English conversation review web app for academy material. The app helps the user repeatedly recall and retain sentence/expression-level English content, Korean meanings, grammar/theory notes, and user-provided examples.

The MVP is a focused reveal-quiz review app, not an AI tutor, exam system, full lecture-note app, or desktop-first product.

## Users and Jobs To Be Done

### Primary user

A single learner who attends an English academy and wants to review class material daily on a phone.

### Jobs

1. Enter learned sentence/expression cards quickly after class.
2. Store Korean meaning, class grammar/theory memo, and a few examples.
3. Open the app daily and immediately start a useful review session.
4. Try to recall hidden card information before revealing it.
5. Mark each card as known or confusing.
6. Revisit confusing cards later.

## MVP Scope

### In scope

- Next.js App Router web app, mobile-first.
- Supabase-backed persistence.
- Free-hosting-friendly deployment plan, proposed default: Vercel Hobby + Supabase Free.
- Study card creation, editing, deletion, and listing.
- Required study card fields:
  - English expression/sentence
  - Korean meaning
  - Grammar/theory memo
  - One or more user-provided example sentences
- Review metadata:
  - `status`: `new`, `known`, or `confusing`
  - `last_reviewed_at`
  - `review_count`
- Daily review entry point.
- Reveal quiz flow: hide at least one card field, reveal on tap/click, then mark known/confusing.
- Simple confusing-card revisit behavior.
- Mobile states for empty, loading, and error cases.
- Setup/deployment documentation with environment variables but no secrets.

### Out of scope / non-goals

- AI-generated examples, explanations, quizzes, or tutoring.
- Complex exam mode, timers, rankings, advanced scoring dashboards.
- Full freeform lecture-note system.
- Desktop-first optimization.
- Voice/pronunciation features unless later explicitly confirmed.
- Public hosted no-auth Supabase deployment without a safe access-control model.
- Silent finalization of major product/technical decisions.

## Official Documentation Grounding

- Next.js current installation docs state the recommended `create-next-app` defaults include TypeScript, ESLint, Tailwind CSS, App Router, Turbopack, and `@/*` import alias; minimum Node.js version is 20.9.
- Next.js deployment docs describe Node.js server, Docker, static export, and adapter deployment; static export has limited feature support, and Vercel is listed as a verified adapter.
- Supabase Next.js guidance uses `@supabase/supabase-js`, `@supabase/ssr`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and separate browser/server utility clients.
- Supabase billing docs state the Free Plan grants two free projects.
- Vercel Hobby is a free tier with usage caps and personal/non-commercial restriction.

Sources used during planning:
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/getting-started/deploying
- https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://vercel.com/docs/plans/hobby

## Confirmation Gates Before Execution

All decision gates below are now confirmed for MVP implementation.

### Gate 1 — Auth vs private single-user flow

**Decision: Supabase Auth selected.**

Use the auth-enabled hosted MVP path:
- Use Supabase Auth, preferably email/password or magic-link.
- Use `owner_id` on owned rows.
- Use owner-scoped RLS.
- Suitable for Vercel Hobby personal/non-commercial deployment, assuming usage remains within free-tier caps.

Rejected path:
- Constrained private single-user MVP is not selected for the initial implementation.
- Public hosted Supabase access without auth/RLS remains blocked.

### Gate 2 — Supabase schema and RLS

**Decision: approved as proposed.**

Use this schema baseline:

```sql
study_cards (
  id uuid primary key,
  owner_id uuid references auth.users(id),
  english_text text not null,
  korean_meaning text not null,
  grammar_note text not null,
  status text not null default 'new' check (status in ('new', 'known', 'confusing')),
  last_reviewed_at timestamptz,
  review_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

card_examples (
  id uuid primary key,
  card_id uuid not null references study_cards(id) on delete cascade,
  example_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
)
```

Rationale:
- Separate `card_examples` keeps example add/edit/reorder/delete simple and future-proof without turning the card row into a large JSON blob.
- `updated_at` should be maintained by app code in MVP unless a database trigger is explicitly chosen later. MVP verification should confirm updates change `updated_at` when app-managed.

**RLS decision:**
- Enable RLS on both tables.
- `study_cards`: users may `select`, `insert`, `update`, and `delete` only rows where `owner_id = auth.uid()`.
- `card_examples`: users may `select`, `insert`, `update`, and `delete` examples only when the parent card is owned by `auth.uid()`.

### Gate 3 — Hosting target

**Decision: Vercel Hobby + Supabase Free.**

Use Vercel Hobby for the Next.js app and Supabase Free for Auth/database, assuming this remains a personal/non-commercial learning app and expected usage fits free-tier caps.

### Gate 4 — Review scheduling rule

**Decision: confusing-first + least-recently-reviewed.**

The daily queue prioritizes `confusing` cards first, then least-recently-reviewed `new`/`known` cards. Keep daily count small/configurable during implementation.

### Gate 5 — Voice/pronunciation wording

**Decision: explicitly excluded from MVP.**

Voice/pronunciation features are deferred until a future product phase. MVP remains text-based reveal review.

## User Stories

### Story 1 — Create study card

As a learner, I can create a card with an English sentence/expression, Korean meaning, grammar/theory memo, and examples so that I can store class material in a reviewable format.

Acceptance:
- Required text fields cannot be blank.
- At least one example can be stored.
- The saved card persists after refresh.

### Story 2 — Manage cards

As a learner, I can view, edit, and delete cards so that my study material stays accurate.

Acceptance:
- Card list is usable on a phone viewport.
- Edit persists changed content.
- Delete removes the card and its examples.

### Story 3 — Daily reveal review

As a learner, I can start a daily review session where card content is hidden until I reveal it, so that I practice recall instead of only reading.

Acceptance:
- Review entry point is reachable from the home screen.
- At least one card field is hidden before reveal.
- A tap/click reveals the hidden content.
- Zero-card state explains what to do next.

### Story 4 — Mark known/confusing

As a learner, I can mark a reviewed card as known or confusing so that the app remembers what I should revisit.

Acceptance:
- Marking updates `status`, `last_reviewed_at`, and `review_count`.
- Status persists after refresh.
- Confusing cards can be found or prioritized later.

### Story 5 — Revisit confusing cards

As a learner, I can find confusing cards again so that weak expressions get repeated.

Acceptance:
- There is a clear route/filter/queue for confusing cards.
- Confusing-first behavior matches the confirmed scheduling gate.

## Route / Screen Proposal

Final route names can be adjusted during implementation, but planning assumes:

- `/` — mobile-first dashboard with daily review CTA and quick stats.
- `/cards` — card list and search/filter basics.
- `/cards/new` — create card.
- `/cards/[id]/edit` — edit card.
- `/review` — reveal-review session.
- `/review/confusing` or filter within `/review` — confusing-card review.
- `/login` — only if auth-enabled MVP is confirmed.

## UX Principles

- Phone viewport first; desktop can be functional but not optimized.
- Initial mobile smoke viewport target: **390 × 844 CSS pixels** (iPhone 12/13/14-ish baseline). Additional optional checks: 360 × 800 and 428 × 926.
- Large tap targets for reveal and known/confusing actions.
- Minimal navigation: the daily review action should be obvious from home.
- Favor cards and short forms over long note surfaces.
- Empty states should guide the user to create the first card or review confusing cards.

## RALPLAN-DR Summary

### Principles

1. Mobile-first recall loop over broad note-taking.
2. Manual academy-content fidelity; no AI generation in MVP.
3. Free-tier-friendly by default, without overpromising unlimited use.
4. Explicit security decisions before hosted Supabase deployment.
5. Testable MVP slices.

### Decision drivers

1. Fast daily use on phone.
2. Low operational complexity/cost.
3. Data ownership and privacy clarity.

### Options considered

#### Option A — Recommended: Next.js App Router + Supabase + optional auth, Vercel Hobby

Pros:
- Matches user’s chosen stack.
- Aligns with current Next.js defaults and Supabase Next.js guidance.
- Supports future multi-device use.

Cons:
- Requires auth/RLS/schema decisions before safe hosted execution.
- External Supabase/Vercel setup is credential-gated.
- Vercel Hobby is personal/non-commercial and usage-capped.

#### Option B — Static-export-style Next.js + direct Supabase client

Pros:
- Simpler hosting model.
- Less server runtime dependence.

Cons:
- Static export has limited Next.js feature support.
- Auth/security model becomes more constrained.
- Less aligned with Supabase SSR guidance.

#### Option C — Local-only storage first, Supabase later

Rejected as the default because it conflicts with the user’s Next.js + Supabase/free-hosting direction and postpones the security/data decisions the user wants planned.

## ADR

### Decision

Recommend Option A: a mobile-first Next.js App Router MVP using TypeScript, Tailwind, ESLint, Supabase for persistence/auth-ready data access, and Vercel Hobby as the proposed deployment target for personal/non-commercial use. Execution remains blocked on the five confirmation gates.

### Drivers

- User specified Next.js + Supabase and free-hosting-friendly setup.
- The product needs durable storage for study cards and review status.
- Daily phone-based reveal review is the core experience.
- User requested no major silent decisions.

### Alternatives considered

- Static export with direct Supabase client.
- Local-only browser storage first.

### Why chosen

Option A best balances the user’s preferred stack, free-tier-friendly deployment, durable persistence, and future multi-device path. It is mainstream enough for quick MVP work while keeping security choices explicit.

### Consequences

- Supabase setup and environment variables are required.
- Supabase Auth is selected; RLS now becomes a required part of schema, implementation, and tests.
- Public hosted Supabase access must not proceed without owner-scoped RLS or another confirmed safe access-control model.
- Vercel Hobby is only appropriate for personal/non-commercial usage within caps.
- Static export should not be chosen if auth/server behavior is needed.

### Follow-ups

1. Write concrete Supabase policies and tests before feature completion.
2. Decide execution lane: `$ralph` for controlled sequential execution or `$team` for parallel lanes.
3. Revisit voice/pronunciation, spaced repetition, AI assistance, and analytics after MVP validation.

## Implementation Plan

### Phase 0 — Decision gate closure

- Auth mode is confirmed: Supabase Auth.
- Schema/RLS is confirmed: proposed `study_cards` + `card_examples` with owner-scoped RLS.
- Hosting is confirmed: Vercel Hobby + Supabase Free.
- Review scheduling is confirmed: confusing-first, then least-recently-reviewed.
- Voice/pronunciation is excluded from MVP.

### Phase 1 — Scaffold and baseline

- Scaffold Next.js App Router with TypeScript, Tailwind, ESLint, Turbopack defaults.
- Confirm Node.js 20.9+ requirement.
- Establish scripts: dev, build, lint, typecheck, test.
- Add baseline smoke test tooling.

### Phase 2 — Supabase setup

- Install `@supabase/supabase-js` and `@supabase/ssr` if auth/server utilities are selected.
- Create browser/server Supabase utility clients.
- Add `.env.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Implement or document schema and RLS per confirmed gate.

### Phase 3 — Card management

- Implement mobile-first card list.
- Implement create/edit/delete workflows.
- Validate required fields and example input.
- Persist cards and examples in Supabase.

### Phase 4 — Reveal review

- Implement dashboard/daily review CTA.
- Implement review queue per confirmed scheduling rule.
- Implement hidden-before-reveal interaction.
- Implement known/confusing marking and metadata updates.

### Phase 5 — Verification, polish, and deployment docs

- Verify phone viewport flows.
- Run lint/typecheck/tests/build.
- Add deployment/setup docs.
- Smoke-test deployed app only after credentials and hosting target are configured.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Unsafe no-auth hosted Supabase setup | Block public deployment unless auth/RLS or another safe access-control layer is confirmed. |
| MVP drifts into AI tutor/exam/note app | Keep non-goals in acceptance criteria and review checklist. |
| Supabase setup blocks local development | Provide `.env.example`, setup docs, and test/mocking strategy where practical. |
| Review scheduling overcomplicates MVP | Start with confusing-first + least-recently-reviewed or a simple confusing filter. |
| Free-tier assumptions change or are exceeded | Document Vercel/Supabase limits and keep deployment portable. |
| Mobile UX becomes afterthought | Use 390×844 viewport smoke/e2e target and mobile-first review acceptance. |

## Available Agent Types Roster

- `explore`, `analyst`, `planner`, `architect`, `debugger`, `executor`, `team-executor`, `verifier`, `style-reviewer`, `quality-reviewer`, `api-reviewer`, `security-reviewer`, `performance-reviewer`, `code-reviewer`, `dependency-expert`, `test-engineer`, `quality-strategist`, `build-fixer`, `designer`, `writer`, `qa-tester`, `git-master`, `code-simplifier`, `researcher`, `product-manager`, `ux-researcher`, `information-architect`, `product-analyst`, `critic`, `vision`.

## Follow-up Staffing Guidance

### `$ralph` path — recommended after gate closure for controlled MVP execution

Use one persistent owner with specialist checks:

- `executor` (medium): scaffold, Supabase utilities, CRUD, reveal flow.
- `test-engineer` or `verifier` (medium/high): scheduling, persistence, mobile flow tests.
- `security-reviewer` (medium): required if auth/RLS is selected.
- `designer` or `ux-researcher` (medium/high): mobile-first flow and touch targets.
- `architect` then `critic`/`verifier` (high): final architecture and evidence sign-off.

Launch hint after gates are resolved:

```text
$ralph .omx/plans/prd-english-review-app.md .omx/plans/test-spec-english-review-app.md
```

### `$team` path — recommended if parallel lanes are desired

Suggested 4-lane split using `executor` workers:

1. Scaffold/data integration.
2. Mobile product flows/UI.
3. Tests/verification.
4. Security/docs/deployment.

Launch hint after gates are resolved:

```bash
omx team 4:executor "Build the English review app MVP from .omx/plans/prd-english-review-app.md and .omx/plans/test-spec-english-review-app.md. Split lanes: (1) Next.js/Supabase scaffold and data utilities, (2) mobile card CRUD and reveal-review UI, (3) tests and verification evidence, (4) auth/RLS/security plus deployment docs. Preserve no-AI/no-exam/no-voice MVP scope. Run lint, typecheck, tests, build, mobile smoke checks, persistence checks, and RLS checks if auth is selected before shutdown."
```

Workflow-surface hint:

```text
$team 4:executor "Build the English review app MVP from .omx/plans/prd-english-review-app.md and .omx/plans/test-spec-english-review-app.md with the four lanes described in the approved plan."
```

## Team Verification Path

Before team shutdown:

- pending tasks = 0
- in-progress tasks = 0
- failed tasks = 0 or explicitly accepted
- lint/typecheck/tests/build evidence captured
- mobile viewport evidence captured at 390×844
- persistence checks captured
- auth/RLS checks captured if selected
- deployment docs completed

After team integration, use `verifier` or `architect` for final sign-off.

## Consensus Review Changelog

- Architect required iteration on no-auth security path, confirmable schema, and auth/RLS gate outcomes.
- Draft revised to block public no-auth Supabase hosting without safe access control, propose concrete schema, and expand verification expectations.
- Critic approved and requested final-artifact improvements:
  - preserve five confirmation gates as unresolved decisions;
  - expand RLS `select`/`insert`/`update`/`delete` expectations;
  - specify `updated_at` handling;
  - define mobile viewport target;
  - preserve Vercel Hobby personal/non-commercial wording and public no-auth deployment block.
- User confirmed remaining gates: approved schema/RLS, Vercel Hobby + Supabase Free, confusing-first review scheduling, and no voice/pronunciation in MVP.
