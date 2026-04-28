# Supabase Setup

1. Create a Supabase Free project for personal MVP use.
2. In Authentication > Providers, enable email/password.
3. Copy the project URL and publishable/anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

4. Apply all SQL files in `supabase/migrations/` in timestamp order using the SQL editor or Supabase CLI.
5. Create the app account from `/login` or Supabase Authentication > Users. Keep that user UUID for `INGESTION_OWNER_ID` so the Codex/assistant ingestion route saves expressions into the same account you log in with.
6. Confirm RLS is enabled on all current review/ingestion tables:
   - `expression_days`
   - `expressions`
   - `expression_examples`
   - `question_notes`
   - `ingestion_runs`
7. Legacy rollback tables may also exist from earlier migrations and should keep RLS enabled:
   - `lessons`
   - `study_items`
   - `study_examples`
   - `study_cards`
   - `card_examples`
8. Confirm policies only allow authenticated users to manage rows they own. Locally, run `npm run verify:rls` if Docker is available.

## Minimum env for login and app usage

The browser/server auth path only needs the public Supabase project URL and publishable/anon key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

With only those two variables configured, users can sign up, log in, log out, and use already-saved owner-scoped data. The app intentionally redirects unauthenticated users away from persisted study screens.

## Codex/assistant ingestion server secrets

For the route that lets Codex/assistant turn your chat message into saved study expressions, configure these only in server environments such as `.env.local` or Vercel server env vars:

```bash
INGESTION_API_TOKEN=long-random-token
INGESTION_OWNER_ID=your-supabase-auth-user-uuid
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`INGESTION_API_TOKEN` is not an OpenAI/LLM provider API key. It is just a long random shared secret for this app, so Codex/assistant can call the protected save route and random internet traffic cannot.

Safety requirements:

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
- The ingestion route must reject missing or invalid bearer tokens.
- The ingestion route must assign `owner_id` from `INGESTION_OWNER_ID`, not from request JSON.
- Drafts/revisions may create or update `ingestion_runs`, but `expression_days`/`expressions`/`expression_examples` are inserted only after explicit approval.

## App-managed updated_at

The MVP updates `updated_at` from app code on note edits, review status changes, draft revisions, and ingestion status changes. No database trigger is required for MVP.

## Public deployment safety

Do not deploy a public Supabase-backed app if Auth or the RLS migration has not been applied. A no-auth public Supabase path is out of scope for this MVP.
