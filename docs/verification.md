# Verification Evidence Plan

Required gates from the test spec:

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit/integration/component/security tests: `npm test`
- Build: `npm run build`
- Mobile smoke: `npm run test:e2e` at 390 x 844
- Supabase/RLS: `npm run verify:rls` runs the migration against a disposable local Postgres container with Supabase-like roles/auth.uid() claims; static migration tests and shared-content/per-user-state data-layer tests run under `npm test`. Live hosted verification still requires configured Supabase credentials.

Manual QA checklist:

- Dashboard primary review CTA is visible on a 390 x 844 viewport.
- LLM draft/revision is previewed outside the review UI and does not create lessons/items before approval.
- Ambiguous feedback such as `좋네` does not insert app data.
- Explicit approval such as `이대로 앱에 넣어줘` inserts one lesson with study items/examples.
- Lesson list and lesson detail show the inserted `have to ~` / `I am used to ~` material.
- Item detail shows meaning, nuance, structure, grammar, examples, user memo, and confusion note.
- User memo and confusion note persist after refresh.
- Reveal review hides the answer before reveal.
- Mark confusing, then confirm confusing-only review surfaces that expression first.
- Mark memorized/learning and confirm status changes.
- Confirm empty states for no lessons and no confusing expressions.
- Confirm no full in-app AI tutor, exam/ranking, or voice/pronunciation UI appears.

Convenience command:

```bash
npm run verify:all
```
