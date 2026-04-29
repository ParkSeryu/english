# English Daily Expression Memorization MVP

Mobile-first app for memorizing English sentences learned in class. The user gives an LLM a daily block such as `오늘의 영어표현 (20260427)` with English sentences and Korean meanings, reviews/revises the structured draft in chat, explicitly approves saving, and then studies the saved expressions in the app.

## Stack and hosting decision

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth + Supabase Postgres persistence
- Shared expression content plus per-user Row Level Security (RLS) for progress/questions
- Token-protected Codex/assistant ingestion route for draft/revise/approve writes
- Vercel Hobby + Supabase Free for a personal/non-commercial MVP, within free-tier usage caps

Public hosted use without Supabase Auth and RLS-backed private progress/questions is intentionally blocked by product policy. Public no-auth expression ingestion is also intentionally blocked.

## MVP scope

Included:

- Email/password Supabase Auth
- LLM/skill-facing daily expression ingestion contract
- Draft and revision turns before app insertion
- Explicit approval required before inserting expression days/cards/examples
- Shared expression day list, expression detail, and per-user memo editing
- Korean-first memorization: Korean prompt visible, English hidden until reveal
- `맞췄음` / `모름` review actions with per-user `known_count`, `unknown_count`, `review_count`, and `last_result`
- Unknown-count-weighted queue scheduling so repeated `모름` appears earlier
- Bottom GNB with `표현`, `암기`, `질문거리`
- Quick question notes for class ideation: add, mark asked, reopen
- Mobile-first layout with a 390 × 844 smoke target

Excluded from MVP:

- Heavy in-app lesson input as the primary data path
- Full AI tutor chat inside the app
- Full grammar notebook, tags, search, calendar, or long note system
- Exam timers, rankings, streaks, or advanced scoring
- Complex SRS/SM-2 scheduling
- Voice/pronunciation features excluded from MVP

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# For Codex/assistant ingestion, also set server-only INGESTION_API_TOKEN, INGESTION_OWNER_ID, and SUPABASE_SERVICE_ROLE_KEY.
# INGESTION_API_TOKEN is a random app secret, not an OpenAI/LLM API key.
npm run dev
```

Create a Supabase project, enable email/password Auth, then apply all migrations in `supabase/migrations/` in timestamp order.

## Codex/assistant ingestion safety

The ingestion route stores draft/revision payloads in `ingestion_runs`; it does not create reviewable `expression_days` or `expressions` until the approval endpoint receives an explicit save phrase such as `저장해`, `앱에 넣어줘`, or `이대로 추가해`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. The protected ingestion route must use `INGESTION_API_TOKEN` and assign audit `owner_id` from server-only `INGESTION_OWNER_ID`, never from client-provided JSON. Learner visibility is shared after approval; progress remains per user.

## Verification commands

```bash
node --version
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:perf
npm run verify:rls
```

`npm run test:perf` runs the Playwright desktop FCP budget check against `/`, `/expressions`, `/memorize`, and `/questions`. The budget is 3,000 ms to match the Vercel Speed Insights "great FCP" cutoff. `npm run verify` runs lint, typecheck, unit/integration/security tests, build, and e2e (including the FCP budget check) with runtime cleanup between build and dev-server phases. `npm run verify:all` also runs the Docker-backed local RLS verification.

Playwright e2e uses a guarded in-memory store only when `E2E_MEMORY_STORE=1` and `E2E_FAKE_USER_ID` are set by the Playwright web server command. This test bypass is disabled when `NODE_ENV=production` and must not be configured in Vercel.

## Environment variables

See `.env.example`. Do not commit real Supabase keys or secrets.
