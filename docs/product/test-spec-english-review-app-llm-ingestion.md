# Test Spec: English Review App — LLM-Assisted Lesson Ingestion MVP

## Source

- PRD: `.omx/plans/prd-english-review-app-llm-ingestion.md`
- Rollback checkpoint: git commit `18440a0`

## Quality Gates

Implementation is complete only when:

1. Lint passes.
2. Typecheck passes.
3. Unit tests pass.
4. Integration tests pass.
5. Build passes.
6. Mobile e2e passes at 390×844.
7. LLM ingestion payload validation passes.
8. Lesson insertion persists to Supabase or verified test store.
9. Owner-scoped RLS passes for all new tables.
10. User memo/confusion note editing persists.
11. Review modes hide answers before reveal.
12. No public no-auth ingestion endpoint exists.

## Test Matrix

| Area | Test Type | Required Evidence |
|---|---|---|
| Ingestion payload schema | Unit | Valid lesson payload accepted; malformed payload rejected. |
| LLM normalization | Unit/static | Required fields exist for each study item. |
| Insert lesson | Integration | Lesson, items, and examples inserted atomically. |
| Raw input traceability | Integration | Raw user input stored on lesson and/or ingestion run. |
| Owner scope | Integration/security | User A cannot see or mutate User B lessons/items/examples. |
| RLS | SQL/container | Select/insert/update/delete policies pass for lessons, study_items, study_examples, ingestion_runs. |
| Lesson list | E2E | Mobile user sees LLM-added lesson grouped by date/source. |
| Item detail | E2E/component | Meaning, nuance, structure, examples, memo fields render. |
| Memo editing | E2E/integration | User memo and confusion note save and survive refresh. |
| Recall review | E2E/component | Meaning-to-expression and expression-to-meaning reveal modes hide answer first. |
| Review status | Integration/e2e | Marking updates status, last_reviewed_at, review_count. |
| Safety | Static/security | No unauthenticated public insert route; destructive LLM actions blocked or absent. |

## Acceptance Criteria Mapping

### AC-001 — LLM can add a lesson

Verification:

- Given natural-language lesson input and normalized JSON payload, validation succeeds.
- Insert action creates one lesson and multiple study items.
- Examples are associated with the correct items.
- App displays the inserted lesson.

### AC-002 — App is review-first, not input-first

Verification:

- Home prioritizes review/recent lessons.
- Heavy manual card creation is removed, hidden, or de-emphasized.
- Main nav points to lessons/review, not manual card entry.

### AC-003 — Personal notes are editable

Verification:

- User can edit `user_memo`.
- User can edit `confusion_note`.
- Edits update `updated_at` and persist after refresh.

### AC-004 — Active recall works

Verification:

- Review prompt can show Korean meaning/nuance while hiding English expression.
- Review prompt can show English expression while hiding meaning.
- Reveal interaction exposes the answer.
- Marking confidence persists.

### AC-005 — RLS/Auth safety holds

Verification:

- Unauthenticated users cannot access data.
- User A can manage own lessons/items/examples.
- User A cannot manage User B data.
- LLM ingestion does not create unowned rows.

## Suggested Commands

```bash
node --version
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run verify:rls
```

## Manual QA

- Tell the LLM a sample lesson with `have to` and `I am used to`.
- Confirm the app shows a lesson page with both expressions.
- Confirm each expression has Korean meaning, nuance, structure, examples, and memo fields.
- Add a user memo and refresh.
- Run meaning-to-expression recall.
- Mark one item confusing.
- Confirm confusing item appears first later.

## Known Test Gaps to Resolve During Implementation

- Need exact implementation choice for LLM ingestion path before final e2e can be written.
- Live Supabase verification requires configured credentials; local RLS container test should remain available.
