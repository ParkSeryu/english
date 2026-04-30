# PRD: Spaced Repetition Interval Policy for Memorize Queue

## Status

Approved for implementation in isolated worktree `feature/srs-interval-policy`.

## Problem

The memorize queue stores `interval_days` and `due_at`, but remembered expressions currently come back every Korean-calendar day because `due_at` is set to the next Korean midnight and known-card queue eligibility ignores future `due_at` values. Learners need a simple spaced-repetition policy that distinguishes expressions remembered immediately from expressions remembered only after one or more `모름` attempts.

## Goals

- Use the existing two-button UX: `모름` and `외웠음`.
- Make `due_at` the source of truth for when reviewed expressions return to `/memorize`.
- Reward immediate recall with a longer next interval.
- Avoid harsh full resets when a mature card is missed.
- Prevent repeated same-day `모름` taps from repeatedly degrading the long-term interval.
- Keep unknown cards in the active session queue until the learner marks them remembered.
- Avoid a database schema change if the existing progress fields can support the policy safely.

## Non-goals

- Add FSRS/SM-2 ease factors, difficulty, stability, or new rating buttons.
- Add a third/fourth answer button such as `어려움` or `쉬움`.
- Change the visible memorize card UI or navigation layout.
- Introduce new dependencies.

## Policy

### Interval ladder

Use this bounded ladder:

```text
1일 → 3일 → 7일 → 14일 → 30일
```

### `외웠음` behavior

When the learner presses `외웠음`:

1. If the previous saved result is not `unknown`, treat this as immediate recall and promote one ladder step.
2. If the card has never been reviewed and the first answer is immediately `외웠음`, schedule it for `3일` later instead of `1일` later.
3. If the previous saved result is `unknown`, treat this as recovery after a lapse and do not promote. Schedule using the current lapsed interval, with a minimum of `1일`.
4. Set `due_at` to the selected interval's Korean-midnight boundary.
5. Remove the card from the active queue after the server refresh, as today.

Examples:

| Previous state | Action | New interval | Next due |
| --- | --- | ---: | --- |
| New card, no previous `모름` | `외웠음` | 3 | 3 Korean days later at 00:00 |
| New card after one or more `모름` | `외웠음` | 1 | Next Korean day at 00:00 |
| 14-day card, no previous `모름` | `외웠음` | 30 | 30 Korean days later at 00:00 |
| 14-day card after one or more `모름` | `외웠음` | 7 | 7 Korean days later at 00:00 |

### `모름` behavior

When the learner presses `모름`:

1. Keep `due_at = null` so the expression remains immediately due.
2. Move the card to the back of the current browser queue, preserving the current session behavior.
3. If this is the first `모름` saved for this card on the current Korean date, demote one ladder step.
4. If the previous saved result is already `unknown` from the same Korean date, do not demote again.
5. Do not demote below `1일` for previously learned cards; new/unlearned cards can remain at `0일` until recovered.

Examples:

| Previous interval | First `모름` that Korean day | Repeated same-day `모름` |
| ---: | ---: | ---: |
| 30 | 14 | 14 |
| 14 | 7 | 7 |
| 7 | 3 | 3 |
| 3 | 1 | 1 |
| 1 | 1 | 1 |
| 0 | 0 | 0 |

### Queue eligibility

`/memorize` should include:

- never-reviewed expressions,
- expressions with `due_at = null`,
- expressions whose `due_at <= now`.

Known expressions with future `due_at` must stay out of the queue even if their last review happened on a previous Korean day. For old rows with `last_result = known` but missing `due_at`, keep the existing safe fallback: hide them until the next Korean day, then treat them as due.

## Data model

No schema change is required for this version.

Use existing `expression_progress` fields:

- `interval_days` — current ladder interval or `0` for unlearned/relearning new cards.
- `last_result` — identifies unresolved lapse state (`unknown`) before the next `외웠음`.
- `last_reviewed_at` — identifies repeated same-day `모름` attempts.
- `due_at` — source of truth for queue reappearance.

## Acceptance criteria

- A new expression marked immediately `외웠음` receives `interval_days = 3` and a `due_at` three Korean calendar days later.
- A new expression marked `모름` one or more times, then `외웠음`, receives `interval_days = 1` and a next-day Korean-midnight `due_at`.
- A 14-day expression marked immediately `외웠음` receives `interval_days = 30`.
- A 14-day expression marked `모름` one or more times, then `외웠음`, receives `interval_days = 7`.
- Repeated same-day `모름` taps do not repeatedly demote the interval.
- Future-due known expressions do not appear in `scheduleMemorizationQueue`.
- Unknown expressions remain due and can still be cycled to the back of the client-side queue.
- Existing tests, lint, typecheck, build, and a live `/memorize` route check pass.

## Verification plan

- Unit-test interval promotion, lapse demotion, repeated same-day `모름`, and Korean-midnight `due_at` calculation in `lib/scheduling.ts`.
- Integration-test `MemoryExpressionStore.recordReviewResult()` for new direct recall, new lapse recovery, mature direct recall, and mature lapse recovery.
- Run lint, typecheck, relevant Vitest suites, full test suite, and build.
- Start the Next dev server bound to `0.0.0.0` and exercise `/memorize` with HTTP checks.
