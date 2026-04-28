# English Review App MVP

Mobile-first review app for English academy material. The revised MVP is review-first: the user tells an LLM what they learned, reviews and revises the structured draft in chat, explicitly approves saving, and then studies the saved lessons in the app.

## Stack and hosting decision

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth + Supabase Postgres persistence
- Owner-scoped Row Level Security (RLS)
- Token-protected LLM ingestion route for draft/revise/approve writes
- Vercel Hobby + Supabase Free for a personal/non-commercial MVP, within free-tier usage caps

Public hosted use without Supabase Auth and owner-scoped RLS is intentionally blocked by product policy. Public no-auth lesson ingestion is also intentionally blocked.

## MVP scope

Included:

- Email/password Supabase Auth for the review app
- LLM/skill-facing lesson ingestion contract
- Draft and revision turns before app insertion
- Explicit approval required before inserting lessons/items/examples
- Lesson list, expression detail, user memo, and confusion note editing
- Reveal-first active recall modes
- New/learning/memorized/confusing status updates with `last_reviewed_at` and `review_count`
- Confusing-only revisit route and confusing-first queue scheduling
- Mobile-first layout with a 390 x 844 smoke target

Excluded from MVP:

- Heavy in-app lesson input as the primary data path
- Full AI tutor chat inside the app
- Exam timers, rankings, or advanced scoring
- Voice/pronunciation features excluded from MVP

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# For LLM ingestion, also set server-only INGESTION_API_TOKEN, INGESTION_OWNER_ID, and SUPABASE_SERVICE_ROLE_KEY.
npm run dev
```

Create a Supabase project, enable email/password Auth, then apply all migrations in `supabase/migrations/` in timestamp order.

## LLM ingestion safety

The ingestion route stores draft/revision payloads in `ingestion_runs`; it does not create reviewable `lessons` or `study_items` until the approval endpoint receives an explicit save phrase such as `저장해`, `앱에 넣어줘`, or `이대로 추가해`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. The protected ingestion route must use `INGESTION_API_TOKEN` and assign `owner_id` from server-only `INGESTION_OWNER_ID`, never from client-provided JSON.

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
