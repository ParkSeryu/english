import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import { hasIngestionEnv, hasSupabaseEnv } from "@/lib/env";
import { getExpressionStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">English Recall</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">오늘 배운 표현, 바로 외우기</h1>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-black text-ink">시작하기</Link>
        </section>
        {!hasSupabaseEnv() ? <EnvWarning /> : null}
      </div>
    );
  }

  const store = getExpressionStore(user);
  const [stats, days, queue] = await Promise.all([store.getDashboardStats(), store.listExpressionDays(), store.getMemorizationQueue({ limit: 3 })]);
  const recentDays = days.slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">오늘의 암기</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">모르는 표현이 먼저 나오는 암기 큐</h1>
        <p className="mt-4 text-sm leading-6 text-slate-200">한국어 프롬프트를 먼저 보고 영어 정답은 숨깁니다. 맞췄음/모름 기록만으로 단순하게 우선순위를 정합니다.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <StatCard label="표현" value={stats.total} />
          <StatCard label="미확인" value={stats.unseenCount} />
          <StatCard label="맞춤" value={stats.knownReviews} />
          <StatCard label="모름" value={stats.unknownReviews} />
        </div>
        <Link href="/memorize" className="btn-primary mt-6 flex min-h-16 text-lg">오늘 암기 시작</Link>
      </section>

      {stats.total === 0 ? (
        <EmptyState title="아직 저장된 표현이 없습니다" body="LLM에게 수업 내용을 말하고 초안을 확인한 뒤 '이대로 앱에 넣어줘'처럼 명시적으로 승인하면 표현이 저장됩니다." actionHref="/expressions" actionLabel="표현 보관함 보기" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/expressions" className="btn-secondary flex min-h-16">표현 보기</Link>
          <Link href="/memorize" className="btn-primary flex min-h-16">암기하기</Link>
          <Link href="/questions" className="btn-ghost flex min-h-16 items-center justify-center">질문거리</Link>
        </div>
      )}

      {recentDays.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-ink">최근 표현 묶음</h2><Link href="/expressions" className="text-sm font-bold text-teal-700">전체 보기</Link></div>
          <div className="space-y-3">
            {recentDays.map((day) => (
              <Link key={day.id} href={`/expressions?day=${day.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{day.day_date ?? "날짜 없음"}</p>
                <h3 className="mt-2 text-xl font-black text-ink">{day.title}</h3>
                <p className="mt-2 text-sm text-slate-600">표현 {day.expressions.length}개 · {day.source_note ?? "LLM 정리"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {queue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-black text-ink">다음 암기 후보</h2>
          <div className="space-y-3">
            {queue.map((expression) => (
              <Link key={expression.id} href={`/expressions/${expression.id}`} className="block rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h3 className="font-black text-ink">{expression.korean_prompt}</h3><span className="text-xs font-bold text-amber-700">모름 {expression.unknown_count}</span></div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{expression.english}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!hasIngestionEnv() ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">LLM ingestion API 환경 변수가 아직 설정되지 않았습니다. INGESTION_API_TOKEN과 INGESTION_OWNER_ID가 필요합니다.</div> : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl bg-white/10 p-3"><div className="text-2xl font-black">{value}</div><div className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</div></div>;
}
function EnvWarning() {
  return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Supabase 환경 변수가 아직 설정되지 않았습니다. 로컬 사용은 `.env.example`을 `.env.local`로 복사해 설정하세요.</div>;
}
