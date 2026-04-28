# Implementation Plan: Daily English Expression Memorization MVP

## Status

- Mode: team execution complete.
- Source PRD: `docs/product/prd-daily-expression-memorization.md`.
- Source test spec: `docs/product/test-spec-daily-expression-memorization.md`.
- Prior implementation checkpoint: `f96eebd`.
- Implementation checkpoint: team-complete merge `6f6fb14`, final fix commit follows this document update.

## Decision

Rebuild the current lesson-oriented app into a daily expression memorization app. Use new expression-day naming in code and database where practical, while leaving older migrations/tables as legacy rollback artifacts.

## Principles

1. Sentence memorization over concept management.
2. Korean prompt first, English hidden until reveal.
3. Buttons stay simple: `맞췄음` / `모름`.
4. Unknown-weighted scheduling, not complex SRS.
5. Question ideation is lightweight and fast.
6. Approval-gated LLM ingestion remains mandatory.

## Implementation Phases

### Phase 1 — Types, validation, scheduling

- Replace lesson/study-item domain language with:
  - `ExpressionDay`
  - `ExpressionCard`
  - `QuestionNote`
  - `ExpressionIngestionPayload`
- Validation accepts daily expression payloads.
- Add date normalization helper for `260427`, `20260427`, `YYYY-MM-DD`.
- Replace status scheduling with counter-based queue:
  - unknown desc,
  - never-reviewed boost,
  - known count penalty,
  - least recently reviewed,
  - source order.

### Phase 2 — Store and ingestion API

- Replace `LessonStore` implementation with `ExpressionStore`.
- Add Supabase + memory methods:
  - list/get expression days,
  - get expression,
  - get memorize queue,
  - record review result (`known`/`unknown`),
  - create/list/update question notes,
  - draft/revise/approve ingestion.
- Update API routes to accept expression-day payloads.
- Keep token auth and explicit approval gate.

### Phase 3 — Database and RLS

- Add migration for:
  - `expression_days`
  - `expressions`
  - `question_notes`
- Update local RLS verifier and static RLS tests.
- Keep `ingestion_runs` owner-scoped.
- Do not rely on old lesson tables for the new app path.

### Phase 4 — UI rebuild

- Replace routes:
  - `/expressions`
  - `/expressions/[id]`
  - `/memorize`
  - `/questions`
- Redirect legacy `/lessons`, `/items`, `/review`, `/cards` paths if needed.
- Add bottom GNB with:
  - 표현
  - 암기
  - 질문거리
- Memorize card shows Korean before reveal, English after reveal, grammar point after reveal.

### Phase 5 — Tests and verification

- Unit: validation/date parsing/scheduling/approval.
- Integration: memory store insertion, review counters, question notes, owner scope.
- Component: memorize card hides English before reveal.
- E2E: seeded expression day → memorize → mark unknown → add question.
- RLS: anon denied, owner allowed, cross-owner denied for new tables.


## Worker 3 Review Addendum — Documentation and Code Quality

### Current Code Review Findings

The repository still reflects the previous lesson/review MVP in the worker baseline. Before or during implementation, the team should treat the following as explicit refactor checkpoints rather than incidental cleanup:

- `lib/types.ts` is still centered on `Lesson`, `StudyItem`, lesson examples, and status values (`new`, `learning`, `memorized`, `confusing`). The new domain types should be introduced as the primary app contract instead of adapting the old status model.
- `lib/validation.ts` currently validates lesson ingestion payloads and only accepts `YYYY-MM-DD` dates. It needs an expression-day schema with compact-date normalization for `260427`, `20260427`, and already-normalized `YYYY-MM-DD` inputs.
- `lib/scheduling.ts` currently orders by legacy status. Replace this with an unknown-weighted expression queue that prioritizes `unknown_count`, never-reviewed cards, known-count penalty, least-recent review, and source order.
- `lib/lesson-store.ts` mixes persistence, ingestion approval, review updates, and memory test state for lesson records. Rename or replace it with an `ExpressionStore` surface so UI and tests no longer depend on lesson terminology for the new path.
- `components/AppNav.tsx` is a top header with `레슨` and `복습`; the MVP requires a mobile bottom GNB containing `표현`, `암기`, and `질문거리`, with Questions always reachable.
- Existing pages under `/lessons`, `/items`, `/review`, and `/cards` can remain as redirects/rollback affordances, but the primary routes must be `/expressions`, `/expressions/[id]`, `/memorize`, and `/questions`.
- Current tests assert legacy lesson/status behavior. They should be rewritten around expression-day ingestion, Korean-first reveal, unknown-count queue priority, question notes, and RLS for new tables.

### Code Quality Guardrails

- Keep the domain language consistent: new app code should use `ExpressionDay`, `ExpressionCard`, `QuestionNote`, and `ExpressionIngestionPayload`. Avoid adding new lesson/study-item references outside compatibility redirects or legacy migration comments.
- Preserve the explicit approval gate by keeping draft/revise/approve as separate operations. API routes may prepare or revise drafts, but only approve routes with an approval phrase may insert expression rows.
- Do not accept or persist client-supplied `owner_id`. Store methods and API routes must derive ownership from authenticated user context or the configured ingestion owner.
- Keep Korean-first memorization simple: Korean prompt is visible first; English, grammar point, and naturalness notes are hidden until reveal; only `맞췄음` and `모름` record review results.
- Avoid SRS abstractions for MVP. A small deterministic comparator and direct counter updates are preferable to a scheduler class or configurable algorithm.
- Keep question notes intentionally small: body, open/asked status, optional day/expression links. Do not add tags, search, calendar, AI rewrite, or long-form notes.
- Keep generated routes and actions server-side where possible; favor existing auth helpers and revalidation patterns over introducing new client-side data libraries.

### Concrete Split for Team Execution

#### Schema/Store Lane

Owns database shape, domain types, validation, queue logic, ingestion persistence, and RLS.

- Add a new migration for `expression_days`, `expressions`, and `question_notes` with RLS enabled on all three tables.
- Keep `ingestion_runs` owner-scoped and update its `normalized_payload` usage to expression-day payloads without requiring old lesson tables.
- Add/replace types for expression days, cards, question notes, ingestion payloads, review result (`known | unknown`), and dashboard stats.
- Implement date normalization as a small helper covered by tests. `260427` should normalize to `2026-04-27` under the documented MVP assumption, `20260427` to `2026-04-27`, and invalid dates should fail validation.
- Implement `ExpressionStore` methods:
  - list/get expression days,
  - get expression,
  - get memorize queue,
  - record review result,
  - create/list/update question notes,
  - create/revise/approve ingestion drafts.
- Ensure review updates increment `review_count`, update `last_reviewed_at`, set `last_result`, and increment only the matching known/unknown counter.
- Ensure memory-store behavior mirrors Supabase behavior closely enough for unit, integration, and e2e tests.

#### UI Lane

Owns route replacement, mobile flow, and copy.

- Replace the primary app surface with `/expressions`, `/expressions/[id]`, `/memorize`, and `/questions`.
- Update `/` to summarize recent/today expression days, total expressions, unknown count, known count, and open questions.
- Add a bottom GNB with `표현`, `암기`, and `질문거리`; keep logout/login accessible without displacing the bottom tabs.
- Build the memorize card so the Korean prompt is visible before reveal and English/grammar/naturalness information appears only after `영어 보기`.
- Wire `맞췄음` and `모름` actions to the store review-result API.
- Implement Questions quick-add, open-first listing, `물어봄`, and `다시 열기` actions.
- Redirect legacy `/lessons`, `/items`, `/review`, and `/cards` paths to the closest new route instead of leaving broken lesson screens as the primary path.

#### Tests/Verification Lane

Owns regression coverage and gate commands.

- Replace legacy lesson scheduling tests with unknown-count queue tests covering never-reviewed cards, known-count penalty, least-recent review, and source-order tie-breaks.
- Replace ingestion validation tests with expression-day payload tests, compact-date tests, approval-gate tests, and malformed payload rejection.
- Replace memory store integration tests with expression-day insertion, owner scoping, review counter updates, question note add/asked/reopen, and no-save-before-approval coverage.
- Replace component tests with Korean-first memorize-card reveal behavior.
- Replace mobile e2e with: seed approved expression day → open memorize → verify English hidden → reveal → mark `모름` → confirm priority/counter behavior → add question → mark asked/reopen.
- Update static/security tests to assert no voice/pronunciation UI scope and no unauthenticated write path.
- Update RLS tests and local verifier to cover `expression_days`, `expressions`, `question_notes`, and retained `ingestion_runs` ownership.

### Integration Checklist

Before final integration, verify all of the following against the PRD and test spec:

- [x] No new user-facing primary route depends on `Lesson` or `StudyItem` naming.
- [x] LLM ingestion can draft and revise without inserting rows.
- [x] Explicit approval inserts exactly one expression day with its expressions for the configured owner.
- [x] Non-approval Korean feedback such as `좋네`, `괜찮아`, or `이 문장 자연스러워?` does not insert.
- [x] Memorization starts Korean-first and hides English until reveal.
- [x] `모름` increments `unknown_count`; `맞췄음` increments `known_count`; both increment `review_count`.
- [x] Queue ordering visibly favors higher `unknown_count` without immediately requiring complex SRS.
- [x] Questions bottom tab supports quick add, asked, reopen, and open-first sorting.
- [x] RLS denies anon/cross-owner access and allows owner-scoped access for new tables.
- [x] No voice/pronunciation, speech recognition, gamification, or complex SRS scope was added.

## Team Work Allocation

Use `$team` with a small coordinated team after this plan is committed.

Suggested lanes:

1. **Schema/Store lane** — migration, types, store, RLS verifier.
2. **UI lane** — GNB, expressions, memorize, questions screens.
3. **Tests/Verification lane** — unit/integration/e2e/security test updates.

Integration owner responsibilities:

- Resolve naming consistency across lanes.
- Run final `npm run verify`, `npm run verify:rls`, and `npm audit --audit-level=moderate`.
- Commit with Lore protocol.

## Launch Hint

```text
$team 3:executor "Implement docs/product/implementation-plan-daily-expression-memorization.md. Split lanes into schema/store, UI, and tests. Preserve approval-gated LLM ingestion, owner-scoped RLS, Korean-first memorization, unknown-weighted queue, and Questions GNB tab."
```

## Risks

- Table churn from previous implementation: mitigate by adding new migration and leaving old tables unused.
- Queue overengineering: keep MVP heuristic simple and transparent.
- Question notes scope creep: no tags/search/calendar in MVP.
- LLM altering English sentences: preserve original answer and put suggestions in notes only.

## Definition of Done

- Daily expression days replace lesson UI as the primary app path.
- Memorization uses Korean prompt → hidden English → reveal.
- `모름` counter affects queue priority.
- Questions tab supports quick add/asked/reopen.
- LLM ingestion saves only after explicit approval.
- Full verification passes.
