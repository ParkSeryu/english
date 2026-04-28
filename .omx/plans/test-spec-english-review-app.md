# Test Spec: English Review App MVP

## Status

- Source PRD: `.omx/plans/prd-english-review-app.md`
- Requirements source: `.omx/specs/deep-interview-english-review-app.md`
- Scope: MVP test strategy before implementation
- Execution status: not started
- Current decisions: **Supabase Auth selected; schema/RLS approved; Vercel Hobby + Supabase Free; confusing-first review; voice/pronunciation excluded from MVP**

## Quality Gates

Implementation is not complete until all applicable gates pass:

1. Lint passes.
2. Typecheck passes.
3. Unit tests pass.
4. Integration/component tests pass.
5. Build passes.
6. Mobile viewport smoke/e2e checks pass at **390×844 CSS pixels**.
7. Supabase persistence checks pass.
8. Auth/RLS checks pass because Supabase Auth is selected.
9. Public hosted Supabase deployment without auth/RLS remains explicitly blocked.
10. Deployment docs include environment-variable setup and no secrets.

## Test Matrix

| Area | Test Type | Required Evidence |
|---|---|---|
| Card validation | Unit/component | Blank required fields rejected; at least one example can be entered. |
| Review scheduling | Unit | Confirmed scheduling rule returns confusing cards first or implements confirmed fallback. |
| Card CRUD | Integration | Create, read, update, delete card and examples through app data layer. |
| Reveal review | Component/e2e | Content hidden before reveal, revealed by tap/click, then mark controls appear. |
| Known/confusing state | Integration/e2e | Marking updates status, review count, and last reviewed timestamp. |
| Updated timestamp | Integration | `updated_at` changes on app-managed updates unless a trigger is later chosen. |
| Mobile UX | E2E/smoke | Dashboard, card form, and review flow usable at 390×844. |
| Empty/loading/error states | Component/e2e | Zero-card and no-confusing-card states are understandable. |
| Non-goals | Review/checklist | No AI generation, no exam timers/rankings, no full note system, no voice/pronunciation in MVP unless confirmed. |
| Deployment docs | Manual/static | `.env.example` and setup docs contain required keys but no secrets. |

## Acceptance Criteria → Verification Mapping

1. **Phone-sized viewport reaches daily review**
   - E2E: set viewport 390×844, visit `/`, assert daily review CTA visible and tappable.

2. **Create study card with required fields**
   - Component/integration: fill English text, Korean meaning, grammar note, one example; save; assert card exists.

3. **Edit and delete study card**
   - Integration/e2e: update text and assert persistence; delete and assert card/examples removed.

4. **Reveal review hides content first**
   - Component/e2e: review card renders with selected field hidden; reveal button/tap exposes content.

5. **Mark known/confusing**
   - Integration/e2e: after reveal, mark known/confusing; assert persisted `status`, `last_reviewed_at`, `review_count`.

6. **Confusing cards are revisited**
   - Unit: scheduling/filter selects confusing cards.
   - E2E: mark card confusing, start later review/filter, assert card is present/prioritized.

7. **No AI/exam/note/voice scope drift**
   - Static/manual review: no AI generation dependencies or UI, no timer/ranking dashboard, no broad freeform notes, no voice/pronunciation UI unless later confirmed.

8. **Free-hosting-friendly setup documented**
   - Manual/static: setup docs identify chosen hosting and Supabase env vars, and preserve Vercel Hobby personal/non-commercial caveat.

## Supabase/Auth/RLS Verification

### Auth-enabled MVP selected

Supabase Auth is selected. RLS expectations must be verified for both tables.

#### `study_cards`

- Unauthenticated user cannot `select` cards.
- Unauthenticated user cannot `insert` cards.
- Unauthenticated user cannot `update` cards.
- Unauthenticated user cannot `delete` cards.
- User A can `select` own cards.
- User A can `insert` own cards with `owner_id = auth.uid()` or server-enforced equivalent.
- User A can `update` own cards.
- User A can `delete` own cards.
- User A cannot `select`, `insert`, `update`, or `delete` rows owned by User B.

#### `card_examples`

- Unauthenticated user cannot `select`, `insert`, `update`, or `delete` examples.
- User A can manage examples only for cards owned by User A.
- User A cannot manage examples for User B cards.
- Deleting a card cascades or otherwise removes associated examples per confirmed schema.

### No-auth path status

- No-auth/private single-user mode is not selected for the initial implementation.
- Public Vercel + Supabase deployment without auth/RLS remains blocked.
- Tests/checklists must verify the app is not presented as safe for public hosting without auth/RLS.

## Suggested Test Tooling

Final tool choice should be confirmed during execution setup, but recommended defaults for a Next.js TypeScript MVP:

- Unit/component: Vitest + Testing Library or Jest + Testing Library.
- E2E/mobile smoke: Playwright.
- Static checks: ESLint, TypeScript, `next build`.

Because the user requested no silent major decisions, execution should record the chosen tooling before adding it.

## Manual QA Checklist

Run after automated checks:

- [ ] On 390×844 viewport, dashboard is readable and primary CTA is obvious.
- [ ] Create a card with a sentence, Korean meaning, theory memo, and example.
- [ ] Refresh and confirm data remains.
- [ ] Edit the card and confirm `updated_at` behavior.
- [ ] Start reveal review and confirm hidden-before-reveal behavior.
- [ ] Mark the card confusing.
- [ ] Re-enter review/filter and confirm confusing card is available.
- [ ] Mark it known and confirm status changes.
- [ ] Verify empty states for no cards and no confusing cards.
- [ ] Confirm no AI generation, exam timers/rankings, full note UI, or voice feature is present.
- [ ] Confirm docs list env vars without secrets.

## Verification Commands Placeholder

Exact package manager and scripts will be created during implementation, but the final evidence should include equivalents of:

```bash
node --version
npm run lint
npm run typecheck
npm test
npm run build
# e2e/mobile smoke command, if configured
```

## Release Readiness

The MVP can be considered ready for user trial only when:

- Supabase Auth and all MVP gates are recorded as selected/resolved.
- PRD acceptance criteria are implemented.
- This test spec’s applicable gates pass.
- Deployment/setup docs are complete enough for external credential configuration.
- Known limitations are documented, especially free-tier and no-auth/public-hosting constraints.

## Decision Update

- Decision update: all MVP gates resolved by user confirmation.
