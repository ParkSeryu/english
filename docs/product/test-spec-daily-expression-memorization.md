# Test Spec: Daily English Expression Memorization MVP

## Source

- PRD: `docs/product/prd-daily-expression-memorization.md`
- Checkpoint before rebuild: `f96eebd`

## Quality Gates

Implementation is complete only when:

1. Lint passes.
2. Typecheck passes.
3. Unit tests pass.
4. Integration tests pass.
5. Build passes.
6. Mobile e2e passes at 390×844.
7. RLS verification passes for new tables.
8. LLM ingestion validation and approval gate tests pass.
9. `모름` weighted review scheduling tests pass.
10. Question note persistence tests pass.

## Test Matrix

| Area | Test Type | Required Evidence |
|---|---|---|
| Daily expression payload | Unit | Valid `오늘의 영어표현` structured payload accepted; missing English/Korean/date rejected. |
| Date normalization | Unit | `260427` and `20260427` normalize to `2026-04-27`; invalid/ambiguous compact dates are rejected instead of silently guessed. |
| Approval gate | Unit/integration/security | Non-approval feedback does not insert; explicit approval inserts or publishes one approved expression day; drafts are not learner-visible. |
| Store insertion | Integration | Expression day and expressions are inserted together as shared content; per-user progress starts empty. |
| Memorization reveal | Component/e2e | Korean is visible before reveal; English hidden until `정답 보기`. |
| Review result state | Integration | `모름` increments cumulative `unknown_count`, resets `interval_days` to 0, keeps `due_at` immediately due, and defers the card to the back of the current session; `외웠음` increments cumulative `known_count`, increases `interval_days`, sets future `due_at`, and both update `review_count`. |
| Queue priority | Unit/integration | Only new/due cards appear; higher unknown count appears before lower unknown/known-heavy due items; future-due known cards are excluded until `due_at`. |
| Grammar point | Component/e2e | Point displays after reveal/detail but is not the primary prompt. |
| Question notes | Integration/e2e | Add question, optionally link it to an expression/day, list open first, mark asked, reopen. |
| RLS | SQL/container/security | Authenticated users can read shared expression content; anonymous users cannot; progress/questions remain cross-user isolated. |
| Scope safety | Static/security | No voice/pronunciation scope; no public no-auth insert endpoint; normal learners cannot write shared expression content. |

## Acceptance Criteria Mapping

### AC-001 — LLM can prepare a daily expression day

- Payload contains title, date, raw input, and at least one expression.
- Each expression has `english` and `korean_prompt`.
- Optional grammar/naturalness notes are accepted.
- Malformed payloads are rejected with actionable errors.

### AC-002 — Save requires explicit approval

- `좋네`, `괜찮아`, `이 문장 자연스러워?`, and revision requests do not insert.
- `이대로 앱에 넣어줘`, `저장해`, or equivalent explicit approval inserts.
- Inserted shared content gets server-assigned audit/import `owner_id`; this owner does not limit learner visibility.
- Learner-visible queries return only approved shared content; drafts remain outside learner review surfaces.

### AC-003 — Memorization hides the answer

- Before reveal: Korean text visible, English hidden.
- After reveal: English answer and grammar/structure/nuance support visible.
- Buttons are `외웠음` and `모름`.

### AC-004 — Unknown-weighted queue improves memorization

- `모름` increments cumulative `unknown_count`, sets `last_result = unknown`, resets `interval_days` to 0, keeps the card immediately due, and defers it to the back of the active session.
- Higher cumulative `unknown_count` due cards rank ahead of lower-priority cards.
- `외웠음` increments cumulative `known_count`, sets `last_result = known`, advances intervals 1 → 3 → 7 → 14 → max 30 days, and excludes the card until `due_at`.
- Future-due cards do not appear in the memorize queue; never-reviewed cards are immediately due.

### AC-005 — Question ideation is quick

- User can add a plain text question from `/questions`.
- User can create a question already linked to an expression or expression day when launched from that context.
- Open questions appear above asked questions.
- User can mark a question as asked and reopen it.

### AC-006 — RLS/Auth safety holds

- Unauthenticated users cannot access persisted shared content or private state.
- User A and User B can both read approved expression days/expressions/examples.
- User A cannot see or mutate User B `expression_progress` or `question_notes`.
- Service-role ingestion path never trusts client-provided `owner_id`; it uses the configured import owner only for audit/draft ownership.
- Normal learners cannot create, update, or archive shared expression days/expressions through app UI or client-provided owner fields.

### AC-007 — Original English is preserved unless replacement is approved

- If the LLM suggests a more natural sentence, the original memorization answer remains unchanged by default.
- Suggested corrections are stored as naturalness/nuance notes or optional alternatives unless the user explicitly approves replacing the answer.
- When replacement is approved, the raw/original sentence remains traceable via `raw_input` and/or `original_english`.

## Suggested Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run verify:rls
npm audit --audit-level=moderate
```

## Manual QA

1. Seed or ingest `오늘의 영어표현 (20260427)` with several English/Korean pairs.
2. Confirm the set appears in `/expression-days`.
3. Start memorization.
4. Confirm Korean prompt is shown and English hidden.
5. Reveal English.
6. Mark one card `모름` multiple times.
7. Confirm it returns when due and appears earlier than lower-unknown due cards.
8. Add a class question in the Questions tab.
9. Mark it asked and reopen it.
10. Log in as a second user/test identity and confirm the same expressions are visible with zero counters and no memo.
11. Confirm no voice/pronunciation UI appears.
