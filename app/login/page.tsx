import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/AuthPanel";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Supabase 로그인</p>
        <h1 className="mt-2 text-3xl font-black text-ink">복습하려면 먼저 로그인하세요</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The MVP uses Supabase 로그인, shared expression content, and per-user RLS for progress/questions. Do not deploy publicly without configured migrations.
        </p>
      </div>
      {!hasSupabaseEnv() ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Supabase 환경 변수가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 추가하세요.
        </div>
      ) : null}
      <AuthPanel />
    </div>
  );
}
