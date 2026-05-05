import Link from "next/link";
import { cache, Suspense } from "react";

import { EmptyState } from "@/components/EmptyState";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getExpressionStore } from "@/lib/lesson-store";
import type { ExpressionDaySummary } from "@/lib/types";
import type { UserIdentity } from "@/lib/types";

export const dynamic = "force-dynamic";

const getDashboardOverviewForUser = cache(async (user: UserIdentity) =>
  getExpressionStore(user).getDashboardOverview({ queueLimit: 0, recentDayLimit: 3 })
);

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <PublicDashboard />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
        <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-extrabold text-teal-100">오늘의 학습</p>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em]">배운 암기,<br />바로 외우기</h1>
        <Link href="/memorize" className="mt-6 flex min-h-14 items-center justify-center rounded-full bg-teal-500 px-5 py-3 text-base font-black text-white shadow-lg shadow-teal-950/30 transition hover:bg-teal-400">학습 시작</Link>
        <Suspense fallback={<StatsGridSkeleton />}>
          <DashboardStatsGrid user={user} />
        </Suspense>
      </section>

      <Suspense fallback={<DashboardSectionsSkeleton />}>
        <DashboardSections user={user} />
      </Suspense>
    </div>
  );
}

function PublicDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
        <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-extrabold text-teal-100">오늘의 학습</p>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em]">배운 암기,<br />바로 외우기</h1>
        <p className="mt-3 text-sm leading-6 text-slate-200">오늘 배운 영어 암기를 가볍게 저장하고 다시 떠올려 보세요.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-black text-ink shadow-lg shadow-black/10">시작하기</Link>
      </section>
      {!hasSupabaseEnv() ? <EnvWarning /> : null}
    </div>
  );
}

async function DashboardStatsGrid({ user }: { user: UserIdentity }) {
  const { stats } = await getDashboardOverviewForUser(user);

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="암기" value={stats.total} />
      <StatCard label="미확인" value={stats.unseenCount} />
      <StatCard label="오늘 복습" value={stats.dueCount} />
      <StatCard label="질문" value={stats.openQuestionCount} />
    </div>
  );
}

async function DashboardSections({ user }: { user: UserIdentity }) {
  const { stats, recentDays } = await getDashboardOverviewForUser(user);

  return (
    <>
      {stats.total === 0 ? (
        <EmptyState title="아직 저장된 표현이 없습니다" body="배운 표현이 생기면 여기에서 바로 복습을 시작할 수 있습니다." actionHref="/expressions" actionLabel="암기 목록" />
      ) : (
        <div className="hidden gap-3 sm:grid sm:grid-cols-2">
          <Link href="/expressions" className="btn-secondary flex min-h-16">암기 목록</Link>
          <Link href="/questions" className="btn-ghost flex min-h-16 items-center justify-center">질문거리</Link>
        </div>
      )}

      {recentDays.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-ink">최근 표현 묶음</h2><Link href="/expressions" className="text-sm font-bold text-teal-700">토픽 보기</Link></div>
          <div className="space-y-3">
            {recentDays.map((day) => (
              <Link key={day.id} href={`/expressions?topic=${day.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{formatRecentDayLabel(day)}</p>
                <h3 className="mt-2 text-xl font-black text-ink">{day.title}</h3>
                <p className="mt-2 text-sm text-slate-600">표현 {day.expressions.length}개 · {day.source_note ?? "학습 노트"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

type DashboardExpressionDaySummary = ExpressionDaySummary & {
  folder_path?: string | string[] | null;
};

function formatRecentDayLabel(day: DashboardExpressionDaySummary) {
  if (!day.folder_path) return day.day_date ?? "날짜 없음";
  const folderPath = Array.isArray(day.folder_path) ? day.folder_path.join(" / ") : day.folder_path;
  if (!day.day_date) return `폴더: ${folderPath}`;
  return `${day.day_date} · ${folderPath}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4 text-white ring-1 ring-white/10">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-300">{label}</div>
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
          <div className="h-8 w-12 animate-pulse rounded-full bg-white/20" />
          <div className="mt-2 h-4 w-16 animate-pulse rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function DashboardSectionsSkeleton() {
  return (
    <section className="space-y-3" role="status" aria-label="대시보드 요약 불러오는 중">
      <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-3 w-24 animate-pulse rounded-full bg-teal-100" />
          <div className="mt-3 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
      <span className="sr-only">불러오는 중</span>
    </section>
  );
}

function EnvWarning() {
  return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Supabase 환경 변수가 아직 설정되지 않았습니다. 로컬 사용은 `.env.example`을 `.env.local`로 복사해 설정하세요.</div>;
}
