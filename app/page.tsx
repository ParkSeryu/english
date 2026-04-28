import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getCardStore } from "@/lib/card-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">텍스트 전용 MVP</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">학원 영어 내용을 가리고 떠올리며 복습하세요.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-200">
            카드를 저장하려면 Supabase 로그인이 필요합니다. Auth/RLS 없는 공개 배포는 의도적으로 차단합니다.
          </p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-black text-ink">
            로그인하고 시작하기
          </Link>
        </section>
        {!hasSupabaseEnv() ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Supabase 환경 변수가 아직 설정되지 않았습니다. 로컬 사용은 `.env.example`을 `.env.local`로 복사해 설정하세요.
          </div>
        ) : null}
      </div>
    );
  }

  const store = getCardStore(user);
  const stats = await store.getDashboardStats();

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">오늘의 복습</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">가장 헷갈리는 카드부터 복습하세요.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-200">
          헷갈린 카드가 먼저 나오고, 그 다음 오래 전에 본 카드가 나옵니다. 음성/발음 기능은 MVP에서 제외했습니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <StatCard label="전체" value={stats.total} />
          <StatCard label="새 카드" value={stats.newCount} />
          <StatCard label="아는 카드" value={stats.knownCount} />
          <StatCard label="헷갈림" value={stats.confusingCount} />
        </div>
        <Link href="/review" className="btn-primary mt-6 flex min-h-16 text-lg">
          오늘 복습 시작
        </Link>
      </section>

      {stats.total === 0 ? (
        <EmptyState title="아직 카드가 없습니다" body="복습하기 전에 영어 문장, 한국어 뜻, 이론 메모, 예문을 담은 첫 카드를 만들어보세요." actionHref="/cards/new" actionLabel="첫 카드 만들기" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/cards/new" className="btn-secondary flex min-h-16">
            수업 내용 추가
          </Link>
          <Link href="/review/confusing" className="btn-ghost flex min-h-16 items-center justify-center">
            헷갈린 카드 다시 보기
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white/10 p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  );
}
