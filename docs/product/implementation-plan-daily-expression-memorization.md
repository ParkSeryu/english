# Implementation Plan: Daily English Expression Memorization MVP

## Status

- Mode: plan-before-team handoff.
- Source PRD: `docs/product/prd-daily-expression-memorization.md`.
- Source test spec: `docs/product/test-spec-daily-expression-memorization.md`.
- Prior implementation checkpoint: `f96eebd`.

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
