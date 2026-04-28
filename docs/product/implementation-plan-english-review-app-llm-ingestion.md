# Implementation Plan: English Review App — LLM-Assisted Lesson Ingestion MVP

## Status

- Mode: planning handoff before implementation.
- Source PRD: `docs/product/prd-english-review-app-llm-ingestion.md`.
- Source test spec: `docs/product/test-spec-english-review-app-llm-ingestion.md`.
- Rollback checkpoint: `18440a0 Preserve current review app before replanning`.
- Current direction commits: `cafe09e` and `7cb64b7`.
- Execution rule: do **not** insert LLM-created lesson data until the user gives an explicit save/insert approval.

## Requirements Summary

1. The app becomes a review/memorization surface, not a heavy manual card-entry surface.
2. Lesson content is prepared by an LLM/skill-like workflow outside the main app UI.
3. The LLM can draft and revise structured lesson data across multiple turns.
4. The app/database receives final lesson data only after explicit approval such as `저장해`, `앱에 넣어`, or `이대로 추가해`.
5. Saved material is organized as lessons, study items, and examples.
6. The user can review by active recall, mark status, and edit `user_memo` / `confusion_note` in the app.
7. Supabase Auth remains required for the review app; all new persisted study tables are owner-scoped by RLS.
8. MVP excludes voice/pronunciation and full in-app AI tutor chat.

## Current Codebase Facts

- The current data/store boundary is card-centric: `CardStore` exposes `listCards`, `createCard`, `updateCard`, `markReviewed`, and review queue methods in `lib/card-store.ts:12-20`.
- Supabase queries currently target `study_cards` and `card_examples` in the store (`lib/card-store.ts:46-52`).
- Current domain types are `StudyCard`, `CardExample`, and `CardInput` in `lib/types.ts:1-45`.
- Validation is built around manual card form fields (`lib/validation.ts:5-27`).
- Server actions are manual-card and review-card oriented (`app/actions.ts:26-87`).
- Main navigation currently points to `/cards` and `/review` (`components/AppNav.tsx:13-22`).
- Dashboard copy and CTA still push manual card creation (`app/page.tsx:35-68`).
- Scheduling is already simple confusing-first ordering (`lib/scheduling.ts:3-27`) and can be adapted to `study_items`.
- Current migration creates only `study_cards` / `card_examples` plus RLS policies (`supabase/migrations/20260428022608_create_study_cards.sql:6-119`).
- RLS tests and Docker verification assume old table names (`tests/security/rls-policy.test.ts:20-55`, `scripts/verify-rls-local.sh:32-126`).
- Current mobile e2e tests exercise manual card creation (`e2e/mobile-review.spec.ts:8-39`, `e2e/mobile-review.spec.ts:41-57`).

## RALPLAN-DR Summary

### Principles

1. **Approval before persistence** — LLM output can be drafted/revised freely, but reviewable study rows are created only after explicit approval.
2. **Review-first UI** — the main app experience should optimize recall, notes, and memorization, not data entry.
3. **Owner scope everywhere** — every lesson, study item, example, and ingestion run belongs to one Supabase user.
4. **Small reversible steps** — add the new lesson model beside the checkpointed old card model first; remove/de-emphasize old routes after tests protect the new path.
5. **No new dependencies by default** — reuse Next, Supabase, Zod, Vitest, and Playwright already in the project.

### Decision Drivers

1. The user explicitly wants to tell an LLM what was learned rather than type it into the app.
2. LLM output may be wrong or not match the teacher's wording, so multi-turn revision and explicit save approval are mandatory.
3. Hosted target is Vercel Hobby + Supabase Free, so the design must be simple and serverless-friendly.

### Viable Options

#### Option A — Skill-facing protected ingestion API + server-side validation (**chosen**)

- Shape: LLM/Codex skill keeps the conversation and sends draft/revision/approval requests to token-protected Next route handlers.
- Draft/revision: stored in `ingestion_runs` only; unapproved data never appears in lessons/review.
- Approval: route validates an explicit approval phrase, then inserts `lessons`, `study_items`, and `study_examples` in one transaction-like flow.
- Auth model for MVP ingestion: server-only `INGESTION_API_TOKEN`, `INGESTION_OWNER_ID`, and Supabase service role key; review UI still uses Supabase Auth/RLS. Service role is never exposed to browser.
- Pros: easiest for LLM skill use, deployable to Vercel Hobby, no new dependency, testable without a large in-app chat UI.
- Cons: single-owner ingestion configuration for MVP; future multi-user ingestion should move to Supabase-session or OAuth-based user context.

#### Option B — Authenticated in-app ingestion UI

- Shape: user logs into app and pastes lesson text into a protected app form; server action drafts and saves.
- Pros: clean Supabase Auth ownership and no service role ingestion route needed.
- Cons: contradicts the user's preference to avoid app data entry; becomes an input app again.
- Verdict: not chosen for MVP primary path. A debug preview page can exist only if it stays secondary.

#### Option C — Public webhook for LLM direct insert

- Shape: LLM posts final data directly to a public endpoint.
- Pros: simple integration surface.
- Cons: fails the safety requirement if unauthenticated or weakly authenticated; high risk of accidental insert without revision/approval.
- Verdict: rejected. The endpoint must never be public/no-auth and must enforce draft/approval separation.

#### Option D — Local-only script that writes straight to Supabase

- Shape: Codex/LLM runs a local script with Supabase service role credentials after approval.
- Pros: no hosted API, very direct for a single developer machine.
- Cons: less useful on Vercel, harder to e2e through app boundaries, easier to bypass approval if script is called incorrectly.
- Verdict: keep as optional helper wrapper around Option A, not the primary boundary.

## ADR

### Decision

Implement an approval-gated lesson ingestion system using:

1. new lesson-first tables (`lessons`, `study_items`, `study_examples`, `ingestion_runs`),
2. shared Zod validation and explicit-approval parsing,
3. token-protected server route handlers for LLM/skill ingestion,
4. a review-first app UI for lessons/items/recall/memos.

### Drivers

- User wants LLM-assisted organization and insertion.
- User needs several back-and-forth revision turns before saving.
- App must remain safe under Supabase Auth/RLS and Vercel Hobby constraints.

### Alternatives Considered

- Heavy in-app form: rejected because it recreates the unwanted data-entry workflow.
- Public no-auth API: rejected because it violates safety and test spec requirements.
- Direct DB writes from the assistant: rejected as primary path because it bypasses app-level validation and is harder to test.

### Why Chosen

Option A gives the LLM a skill-like insertion path while keeping validation, approval checks, route-level security, and database ownership rules inside the app codebase. It also lets e2e tests seed approved lessons through the same boundary without relying on a full external LLM.

### Consequences

- MVP ingestion is single-owner unless/until a session-authenticated ingestion mechanism is added.
- Server-only env configuration must be documented clearly.
- RLS remains essential for normal user-facing access, but service-role ingestion needs dedicated tests proving it assigns only the configured owner.

### Follow-ups

- After MVP, consider replacing `INGESTION_OWNER_ID` with a Supabase-session or OAuth-connected skill flow.
- Consider an in-app read-only ingestion preview history for `ingestion_runs` after the basic review loop is stable.
- Decide later whether to migrate old `study_cards` data into `study_items` or leave old tables as checkpoint-era artifacts.

## Implementation Steps

### Phase 0 — Safety checkpoint and branch hygiene

1. Confirm rollback commits remain available:
   - `18440a0` for the previous working app.
   - `cafe09e`, `7cb64b7` for product/test direction.
2. Keep changes in small commits by layer:
   - schema/types,
   - ingestion validation/API,
   - store/actions,
   - UI,
   - tests/docs.
3. Do not drop old `study_cards` tables in the first migration. Add new tables first to preserve rollback safety.

### Phase 1 — Schema and RLS

Files likely changed:

- `supabase/migrations/20260428022608_create_study_cards.sql` or a new migration under `supabase/migrations/`.
- `scripts/verify-rls-local.sh`.
- `tests/security/rls-policy.test.ts`.
- `docs/supabase-setup.md`.

Work:

1. Add tables from the PRD:
   - `lessons`,
   - `study_items`,
   - `study_examples`,
   - `ingestion_runs`.
2. Add owner indexes for lesson and review queries:
   - `(owner_id, lesson_date desc nulls last, created_at desc)` on `lessons`,
   - `(owner_id, status, last_reviewed_at asc nulls first, created_at asc)` on `study_items`.
3. Enable RLS for all new tables.
4. Add policies:
   - lessons: direct `owner_id = auth.uid()` for select/insert/update/delete.
   - study_items: direct owner policy plus parent lesson consistency check where relevant.
   - study_examples: access through owned parent `study_items`.
   - ingestion_runs: direct owner policy.
5. Grant only necessary access in the local RLS verification script.
6. Update security tests to assert all new policy names and cross-owner denial behavior.

Acceptance evidence:

- SQL text tests mention all four new tables.
- `npm run verify:rls` passes against Docker Postgres.
- No policy allows anon/no-owner access.

### Phase 2 — Domain types, validation, and approval gate

Files likely changed/added:

- `lib/types.ts`.
- `lib/validation.ts` or new `lib/ingestion/schema.ts`.
- new `lib/ingestion/approval.ts`.
- new unit tests under `tests/unit/`.

Work:

1. Replace or extend card types with:
   - `Lesson`,
   - `StudyItem`,
   - `StudyExample`,
   - `IngestionRun`,
   - `LessonIngestionPayload`,
   - `StudyItemInput` / memo update input.
2. Add Zod schema for the LLM payload:
   - lesson title/raw input required,
   - at least one item,
   - expression and `meaning_ko` required,
   - examples bounded,
   - optional memo/confusion/source fields trimmed and length-limited.
3. Add explicit approval parser:
   - approve examples: `저장해`, `앱에 넣어`, `이대로 추가해`, `이대로 앱에 넣어줘`, `save this`, `add to app`.
   - non-approve examples: `좋네`, `괜찮아 보임`, `예문 더 쉽게`, `설명 추가해줘`, question-like corrections.
4. Ensure parser is conservative: ambiguous positive feedback must return `false`.

Acceptance evidence:

- Unit tests cover valid payloads, malformed payloads, approval phrases, and non-approval phrases.
- Validation errors are user-readable enough for LLM correction turns.

### Phase 3 — Lesson store and ingestion service

Files likely changed/added:

- replace/parallelize `lib/card-store.ts` with `lib/lesson-store.ts`.
- new `lib/ingestion/service.ts`.
- `app/test/reset/route.ts`.
- integration tests under `tests/integration/`.

Work:

1. Introduce `LessonStore` APIs:
   - `listLessons()`
   - `getLesson(id)`
   - `getItem(id)`
   - `getDashboardStats()`
   - `getReviewQueue({ mode?, confusingOnly?, limit? })`
   - `markReviewed(id, status)` where status is `learning | memorized | confusing`
   - `updateItemNotes(id, { userMemo, confusionNote })`
2. Implement both Supabase and memory stores.
3. Add ingestion service APIs:
   - `createDraft(payload, rawInput)` -> `ingestion_runs.status = drafted` only.
   - `reviseDraft(runId, payload)` -> updates run payload/status, does not create lesson/items.
   - `approveAndInsert(runId, approvalText)` -> validates approval phrase, inserts lesson/items/examples, marks run inserted.
4. Keep unapproved `ingestion_runs` out of review/list lesson queries.
5. Make insertion effectively atomic from the app perspective:
   - Prefer a Postgres RPC in migration if Supabase JS cannot guarantee multi-table transaction from route handlers.
   - If no RPC in first pass, handle failure by marking `ingestion_runs.status = failed` and keeping partial rows impossible or cleaned up.

Acceptance evidence:

- Integration tests prove draft/revise creates no lessons/items.
- Approval test proves one approved run creates one lesson with correct items/examples.
- Cross-user memory store tests prove user B cannot read/update user A lessons/items.

### Phase 4 — Protected LLM/skill ingestion boundary

Files likely changed/added:

- `app/api/ingestion/runs/route.ts`.
- `app/api/ingestion/runs/[id]/route.ts`.
- `app/api/ingestion/runs/[id]/approve/route.ts`.
- `.env.example`.
- `docs/llm-ingestion-skill.md`.
- optional helper `scripts/ingest-lesson.mjs` that calls the protected API.

Work:

1. Add server-only env variables:
   - `INGESTION_API_TOKEN` for bearer auth.
   - `INGESTION_OWNER_ID` for the single MVP owner.
   - `SUPABASE_SERVICE_ROLE_KEY` only if the protected route must write without browser session cookies.
2. Route behavior:
   - Missing/invalid token returns `401` or `404` without inserting.
   - Draft route validates payload and creates/updates only `ingestion_runs`.
   - Approval route requires both valid token and explicit approval text.
   - Approval route returns saved lesson/item IDs and app URLs.
3. LLM skill flow documentation:
   - LLM drafts structured JSON.
   - LLM shows preview in chat.
   - LLM revises JSON after user feedback.
   - LLM calls draft/revise endpoint as needed.
   - LLM calls approval endpoint only after explicit approval.
4. Add safety tests proving unapproved calls and ambiguous feedback do not insert.

Acceptance evidence:

- API tests cover unauthorized, draft, revision, non-approval, and explicit approval cases.
- Static/security test confirms there is no no-auth insert endpoint.
- `.env.example` warns never to expose service role to browser.

### Phase 5 — Review-first app UI

Files likely changed/added:

- `components/AppNav.tsx`.
- `app/page.tsx`.
- new `app/lessons/page.tsx`.
- new `app/lessons/[id]/page.tsx`.
- new `app/items/[id]/page.tsx`.
- `app/review/page.tsx`.
- `app/review/confusing/page.tsx` if retained.
- `components/ReviewCard.tsx` or new `components/ReviewItemCard.tsx`.
- new note editing component, e.g. `components/ItemNotesForm.tsx`.
- `app/actions.ts`.

Work:

1. Change nav from `카드` to `수업/표현` or `레슨`.
2. Dashboard emphasizes:
   - today/recent lesson summary,
   - review CTA,
   - counts: 새 표현 / 학습 중 / 암기함 / 헷갈림.
3. Hide/remove primary manual `/cards/new` CTA.
4. Add lesson list grouped by lesson date/source.
5. Add lesson detail showing raw input summary and all study items.
6. Add item detail with expression, meaning, nuance, structure, grammar, examples, user memo, and confusion note.
7. Add memo/confusion note server action.
8. Review card modes:
   - meaning/nuance -> recall expression,
   - expression -> recall meaning/usage,
   - structure -> recall pattern/formula.
9. Mark statuses:
   - `learning`,
   - `memorized`,
   - `confusing`.

Acceptance evidence:

- Mobile e2e sees LLM-added lesson without using a manual form.
- Review hides answer before reveal.
- Memo/confusion edits persist after refresh.

### Phase 6 — Scheduling and review behavior

Files likely changed:

- `lib/scheduling.ts`.
- `tests/unit/scheduling.test.ts`.
- `tests/components/review-card.test.tsx`.

Work:

1. Adapt confusing-first sorting to `StudyItem` statuses:
   - `confusing` first,
   - then `new`,
   - then `learning`,
   - then `memorized`,
   - within same status, least recently reviewed first.
2. Make review mode deterministic or test-controllable for e2e.
3. Ensure `markReviewed` increments `review_count` and updates `last_reviewed_at`.

Acceptance evidence:

- Scheduling unit tests cover status priority and stale review ordering.
- Component tests cover reveal/hide and status actions.

### Phase 7 — E2E and full verification

Files likely changed:

- `e2e/mobile-review.spec.ts`.
- `app/test/reset/route.ts`.
- optional `app/test/seed-approved-lesson/route.ts` guarded by `E2E_MEMORY_STORE`.
- `package.json` only if scripts need renaming; no new dependencies.

Work:

1. Replace manual card creation e2e with approved-lesson seed flow:
   - reset guarded memory store,
   - seed an approved `have to` / `I am used to` lesson through test-only route or ingestion service,
   - verify lesson list/detail,
   - run review, reveal, mark confusing/memorized,
   - edit memo and verify persistence.
2. Keep test-only routes unavailable unless `E2E_MEMORY_STORE=1` and non-production.
3. Run full quality gates:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`
   - `npm run verify:rls`
   - `npm audit --audit-level=moderate` if dependency state changes or before final signoff.

Acceptance evidence:

- All listed commands pass with fresh output.
- Manual QA confirms the user flow: LLM draft -> revision -> explicit approval -> app review/memo.

## Test Plan

### Unit

- LLM payload validation accepts complete lessons and rejects missing title/items/expression/meaning.
- Approval parser accepts explicit save phrases and rejects ambiguous feedback.
- Scheduling sorts confusing-first and least-recently-reviewed.
- Review card hides answers before reveal for each recall mode.

### Integration

- Memory store creates lessons/items/examples and keeps owner scopes.
- Draft/revise ingestion runs do not create reviewable rows.
- Explicit approval inserts exactly one lesson graph.
- Non-approval feedback never inserts.
- Memo/confusion note updates persist and update timestamps.

### Security/RLS

- SQL policy text covers `lessons`, `study_items`, `study_examples`, `ingestion_runs`.
- Docker RLS script proves anon denial, owner allow, cross-owner denial.
- Ingestion routes deny missing/invalid bearer token.
- Service-role route assigns only configured `INGESTION_OWNER_ID` and never trusts client-provided `owner_id`.
- No route inserts lesson/items without the approval parser returning true.

### E2E / Mobile

- 390×844 viewport.
- Seed or approve a sample lesson with `have to ~` and `I am used to ~`.
- User sees lesson in `/lessons`.
- User opens item detail and edits memo/confusion note.
- User starts review, answer is hidden, then revealed.
- Marking confusing makes the item appear first in confusing/review flow.

### Observability / Manual QA

- Ingestion approval response includes saved lesson URL and item URLs.
- Failed ingestion stores `error_message` on `ingestion_runs`.
- Manual app run verifies no primary manual card-entry CTA remains.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Service-role ingestion bypasses RLS | Bad owner assignment could pollute data | Never accept client `owner_id`; require `INGESTION_OWNER_ID`; test owner assignment and keep key server-only. |
| LLM saves after ambiguous feedback | Wrong material enters review | Conservative approval parser plus tests for Korean non-approval examples. |
| Partial insert across lesson/items/examples | Broken lesson graph | Prefer RPC transaction or robust failure cleanup/failed run status. |
| UI rewrite touches many files | Regression risk | Phase by layer; preserve tests before removing old card routes. |
| Old card data becomes inaccessible | User confusion if prototype data exists | Leave old tables initially; document migration as follow-up. |
| Public endpoint accidentally available | Security issue | Bearer auth, route tests, static test for no no-auth insert path. |

## Available-Agent-Types Roster

Use only known available roles if handing off to `$ralph` or `$team`:

- `executor` — implementation/refactor slices.
- `test-engineer` — tests, e2e, flaky-test hardening.
- `security-reviewer` — RLS, route auth, service-role boundary.
- `architect` — schema/API boundary and final design signoff.
- `verifier` — final evidence review.
- `code-simplifier` — post-implementation deslop pass on changed files.
- `explore` — fast repo lookups only.
- `writer` — docs and skill usage guide.

## Follow-up Staffing Guidance

### `$ralph` single-owner execution

Recommended because this is a cross-layer refactor with security and verification requirements, but still small enough for one owner to integrate carefully.

Suggested lanes inside Ralph:

1. `executor` for schema/store/API/UI implementation.
2. `test-engineer` for unit/integration/e2e updates after the API/store shape stabilizes.
3. `security-reviewer` for RLS and ingestion-token/service-role review before final verification.
4. `architect` for final signoff.
5. `code-simplifier` after green tests, scoped to changed files only.

### `$team` coordinated execution

Use only if speed matters more than single-owner integration overhead.

Suggested lanes:

1. Schema/RLS lane — migration + RLS verifier.
2. Domain/API lane — types, validation, ingestion routes.
3. UI lane — lessons/items/review pages.
4. Test lane — unit/integration/e2e/security.
5. Docs/skill lane — ingestion skill guide and env docs.

## Launch Hints

### Ralph

```text
$ralph Implement docs/product/implementation-plan-english-review-app-llm-ingestion.md. Preserve the approval gate, owner-scoped RLS, Vercel Hobby + Supabase Free constraints, and no voice/pronunciation scope. Verify lint, typecheck, tests, build, e2e, RLS, and ingestion auth/approval behavior.
```

### Team

```text
$team Implement docs/product/implementation-plan-english-review-app-llm-ingestion.md with lanes: schema/RLS, ingestion API, review UI, tests/e2e, docs. Require integration owner to resolve conflicts and final Ralph/verifier pass before completion.
```

## Team Verification Path

1. Each lane reports changed files and local evidence.
2. Integration owner runs full gates in Phase 7.
3. Security reviewer checks route auth, owner assignment, RLS, and service-role handling.
4. Architect/verifier confirms:
   - no unapproved insertion path,
   - review-first UI,
   - memo persistence,
   - confusing-first scheduling,
   - no voice/pronunciation scope creep.
5. Final report includes changed files, simplifications made, verification evidence, and remaining risks.

## Open Decisions Before/At Implementation

1. Whether to implement lesson insertion as a Postgres RPC for true transactionality or as Supabase JS multi-step insert with cleanup. Preferred: RPC if it stays simple and testable.
2. Whether to retain old `/cards` routes as redirects during MVP or remove them from navigation only. Preferred: redirect/de-emphasize first, delete later after the new flow is stable.
3. Whether the optional helper script is needed immediately. Preferred: document API usage first; add script only if it materially improves the LLM skill workflow.

## Definition of Done

- New lesson-first data model exists and is RLS-protected.
- LLM-facing ingestion supports draft, revision, and explicit approval.
- Non-approval turns never create reviewable lesson/item rows.
- App UI centers lessons, study items, review, and notes.
- Review supports the required recall modes and confusing-first scheduling.
- Supabase persistence and Auth/RLS behavior are verified.
- Full verification passes: lint, typecheck, unit/integration tests, build, mobile e2e, RLS.
