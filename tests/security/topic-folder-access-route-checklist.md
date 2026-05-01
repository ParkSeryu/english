# Topic-folder access verification checklist

This lane focuses on executable security and route-level validation for nested-topic access control.

## 1) Security policy execution (local SQL)

Run when a local Postgres engine is available:

```bash
VERIFY_EXECUTABLE_RLS=1 npm run test -- tests/security/rls-topic-folder-executable.test.ts
```

Expected behavior:
- Script `scripts/verify-topic-folder-access-rls.sh` completes successfully.
- Output contains: `topic-folder-access RLS verification passed`.

## 2) Store-level filtering checkpoints (memory store)

Use `tests/integration/memory-expression-store.test.ts` for existing shared-content regression
coverage. Add/keep cases for:

- Shared topic list visible to multiple users.
- `getExpressionDay(blockedId)` and `getExpression(blockedId)` return `null` once access-control
  fixtures are wired into the memory store.
- `getMemorizationQueue` excludes blocked expressions once restricted fixtures exist.

## 3) Route/live matrix

With a running dev server and target DB migration applied:

- `/` does not render restricted topics/cards.
- `/expressions` topic selector includes only allowed topics.
- `/expressions?topic=<allowed-day-id>` renders allowed topic content.
- `/expressions?topic=<blocked-day-id>` falls back to available topics or empty state.
- `/expressions/<allowed-expression-id>` renders details.
- `/expressions/<blocked-expression-id>` returns not-found.
- `/memorize` renders queue with only accessible cards.

Inspect server logs for errors during these checks:
- `500` / `InternalServerError`
- `RLS` / schema failures
- missing chunk/module errors

## 4) No-silent-fallback guard

If executable ACL behavior changes in a way that cannot satisfy allowed-vs-blocked checks,
stop verification and escalate before shipping (no shared-read fallback).
