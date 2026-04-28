# Supabase Setup

1. Create a Supabase Free project for personal MVP use.
2. In Authentication > Providers, enable email/password.
3. Copy the project URL and publishable/anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

4. Apply all SQL files in `supabase/migrations/` in timestamp order using the SQL editor or Supabase CLI.
5. Confirm RLS is enabled on all review/ingestion tables:
   - `lessons`
   - `study_items`
   - `study_examples`
   - `ingestion_runs`
   - legacy checkpoint tables `study_cards` and `card_examples`
6. Confirm policies only allow authenticated users to manage rows they own. Locally, run `npm run verify:rls` if Docker is available.

## LLM ingestion server secrets

For the LLM/skill ingestion route, configure these only in server environments such as `.env.local` or Vercel server env vars:

```bash
INGESTION_API_TOKEN=long-random-token
INGESTION_OWNER_ID=your-supabase-auth-user-uuid
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Safety requirements:

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
- The ingestion route must reject missing or invalid bearer tokens.
- The ingestion route must assign `owner_id` from `INGESTION_OWNER_ID`, not from request JSON.
- Drafts/revisions may create or update `ingestion_runs`, but lessons/items/examples are inserted only after explicit approval.

## App-managed updated_at

The MVP updates `updated_at` from app code on note edits, review status changes, draft revisions, and ingestion status changes. No database trigger is required for MVP.

## Public deployment safety

Do not deploy a public Supabase-backed app if Auth or the RLS migration has not been applied. A no-auth public Supabase path is out of scope for this MVP.
