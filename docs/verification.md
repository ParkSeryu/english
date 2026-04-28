# Verification Evidence Plan

Required gates from the test spec:

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit/integration/component/security tests: `npm test`
- Build: `npm run build`
- Mobile smoke: `npm run test:e2e` at 390 x 844
- Supabase/RLS: `npm run verify:rls` runs the migration against a disposable local Postgres container with Supabase-like roles/auth.uid() claims; static migration tests and owner-scoped data-layer tests run under `npm test`. Live hosted verification still requires configured Supabase credentials.

Manual QA checklist:

- Dashboard primary review CTA is visible on a 390 x 844 viewport.
- Create a card with English, Korean meaning, grammar memo, and example.
- Refresh and confirm persistence in the configured backing store.
- Edit the card and confirm `updated_at` changes.
- Reveal review hides meaning/memo/examples before reveal.
- Mark confusing, then confirm confusing-only review surfaces that card.
- Mark known and confirm status changes.
- Confirm empty states for no cards and no confusing cards.
- Confirm no AI generation, exam/ranking, broad note, or voice/pronunciation UI appears.

Convenience command:

```bash
npm run verify:all
```
