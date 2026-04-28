# Deployment Notes

Target: Vercel Hobby + Supabase Free for a personal/non-commercial learner MVP.

## Vercel

1. Import the repository into Vercel.
2. Add environment variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Do not set `E2E_MEMORY_STORE` or `E2E_FAKE_USER_ID` in Vercel.
4. Deploy after `npm run build` passes locally.

## Supabase

1. Apply the migration in `supabase/migrations/` before inviting real users.
2. Verify RLS remains enabled for both tables.
3. Keep service-role keys out of the browser and out of this repository.

## Free-tier caveat

Vercel Hobby and Supabase Free are suitable only while the app remains personal/non-commercial and within usage limits. Upgrade or change hosting if the app becomes commercial or exceeds caps.
