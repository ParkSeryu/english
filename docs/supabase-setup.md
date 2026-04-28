# Supabase Setup

1. Create a Supabase Free project for personal MVP use.
2. In Authentication > Providers, enable email/password.
3. Copy the project URL and publishable/anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

4. Apply `supabase/migrations/20260428022608_create_study_cards.sql` in the SQL editor or Supabase CLI.
5. Confirm RLS is enabled on `study_cards` and `card_examples`.
6. Confirm policies only allow authenticated users to manage rows they own. Locally, run `npm run verify:rls` if Docker is available:

   - `study_cards.owner_id = auth.uid()` for select/insert/update/delete.
   - `card_examples` access only through a parent card owned by `auth.uid()`.

## App-managed updated_at

The MVP updates `study_cards.updated_at` from app code on card edits and review status changes. No database trigger is required for MVP.

## Public deployment safety

Do not deploy a public Supabase-backed app if Auth or the RLS migration has not been applied. A no-auth public Supabase path is out of scope for this MVP.
