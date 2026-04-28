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
| Date normalization | Unit | `260427` and `20260427` normalize correctly when unambiguous. |
| Approval gate | Unit/integration/security | Non-approval feedback does not insert; explicit approval inserts one expression day. |
| Store insertion | Integration | Expression day and expressions are inserted together as shared content; per-user progress starts empty. |
| Memorization reveal | Component/e2e | Korean is visible before reveal; English hidden until `정답 보기`. |
| Review result state | Integration | `모름` sets the current user's expression state to unknown (`unknown_count: 1`, `known_count: 0`) without stacking repeated taps; `맞췄음` sets it to known (`known_count: 1`, `unknown_count: 0`); both update that user `review_count`. |
| Queue priority | Unit/integration | Higher unknown count appears before lower unknown/known-heavy items; never-reviewed items remain visible; recently known cards are excluded for 24 hours. |
| Grammar point | Component/e2e | Point displays after reveal/detail but is not the primary prompt. |
| Question notes | Integration/e2e | Add question, list open first, mark asked, reopen. |
| RLS | SQL/container/security | Authenticated users can read shared expression content; anonymous users cannot; progress/questions remain cross-user isolated. |
| Scope safety | Static/security | No voice/pronunciation scope; no public no-auth insert endpoint. |

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

### AC-003 — Memorization hides the answer

- Before reveal: Korean text visible, English hidden.
- After reveal: English answer and grammar/structure/nuance support visible.
- Buttons are `맞췄음` and `모름`.

### AC-004 — Unknown-weighted queue improves memorization

- `모름` sets the current user `unknown_count` to 1 and `known_count` to 0 in `expression_progress`; repeated taps do not stack beyond 1.
- Higher `unknown_count` cards rank ahead of lower-priority cards.
- `맞췄음` sets the current user `known_count` to 1 and `unknown_count` to 0, removes unknown priority, and excludes the card from the memorize queue for 24 hours from `last_reviewed_at`.
- Recently unknown cards do not have to appear immediately next, but remain high priority.

### AC-005 — Question ideation is quick

- User can add a plain text question from `/questions`.
- Open questions appear above asked questions.
- User can mark a question as asked and reopen it.

### AC-006 — RLS/Auth safety holds

- Unauthenticated users cannot access persisted shared content or private state.
- User A and User B can both read approved expression days/expressions/examples.
- User A cannot see or mutate User B `expression_progress` or `question_notes`.
- Service-role ingestion path never trusts client-provided `owner_id`; it uses the configured import owner only for audit/draft ownership.

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
2. Confirm the set appears in expression list.
3. Start memorization.
4. Confirm Korean prompt is shown and English hidden.
5. Reveal English.
6. Mark one card `모름` multiple times.
7. Confirm it appears earlier than cards with many `맞췄음` marks.
8. Add a class question in the Questions tab.
9. Mark it asked and reopen it.
10. Log in as a second user/test identity and confirm the same expressions are visible with zero counters and no memo.
11. Confirm no voice/pronunciation UI appears.
