# English Review App MVP

Mobile-first reveal review for English academy material. The MVP stores sentence/expression cards with Korean meanings, grammar/theory notes, and user-provided examples, then schedules daily review with confusing cards first.

## Stack and hosting decision

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth + Supabase Postgres persistence
- Owner-scoped Row Level Security (RLS)
- Vercel Hobby + Supabase Free for a personal/non-commercial MVP, within free-tier usage caps

Public hosted use without Supabase Auth and owner-scoped RLS is intentionally blocked by product policy.

## MVP scope

Included:

- Email/password Supabase Auth
- Card create/edit/delete/list
- Required English text, Korean meaning, grammar/theory memo, and at least one example
- Reveal-first review flow
- Known/confusing status updates with `last_reviewed_at` and `review_count`
- Confusing-only revisit route and confusing-first queue scheduling
- Mobile-first layout with a 390 x 844 smoke target

Excluded from MVP:

- AI generation/tutoring
- Exam timers, rankings, or advanced scoring
- Full lecture-note system
- Voice/pronunciation features

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Create a Supabase project, enable email/password Auth, then apply the migration in `supabase/migrations/20260428022608_create_study_cards.sql`.

## Verification commands

```bash
node --version
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run verify:rls
```

`npm run verify` runs lint, typecheck, unit/integration/security tests, build, and mobile e2e with runtime cleanup between build and dev-server phases. `npm run verify:all` also runs the Docker-backed local RLS verification.

Playwright e2e uses a guarded in-memory store only when `E2E_MEMORY_STORE=1` and `E2E_FAKE_USER_ID` are set by the Playwright web server command. This test bypass is disabled when `NODE_ENV=production` and must not be configured in Vercel.

## Environment variables

See `.env.example`. Do not commit real Supabase keys or secrets.
