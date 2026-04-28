import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { getCurrentUser } from "@/lib/auth";
import { hasIngestionEnv, hasSupabaseEnv } from "@/lib/env";
import { getLessonStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">Review-first MVP</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">LLM이 정리한 수업 표현을 가리고 떠올리며 복습하세요.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-200">
            앱은 입력 폼보다 복습과 암기에 집중합니다. 저장된 레슨을 보려면 Supabase 로그인이 필요합니다.
          </p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 font-black text-ink">
            로그인하고 시작하기
          </Link>
        </section>
        {!hasSupabaseEnv() ? <EnvWarning /> : null}
      </div>
    );
  }

  const store = getLessonStore(user);
  const [stats, lessons, queue] = await Promise.all([store.getDashboardStats(), store.listLessons(), store.getReviewQueue({ limit: 3 })]);
  const recentLessons = lessons.slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-ink p-6 text-white shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-200">오늘의 복습</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">헷갈리는 표현부터 다시 떠올려보세요.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-200">
          LLM이 정리한 레슨을 기준으로 뜻→표현, 표현→뜻, 구조→패턴 복습을 합니다. 음성/발음 기능은 MVP에서 제외했습니다.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <StatCard label="표현" value={stats.total} />
          <StatCard label="학습 중" value={stats.learningCount + stats.newCount} />
          <StatCard label="암기함" value={stats.memorizedCount} />
          <StatCard label="헷갈림" value={stats.confusingCount} />
        </div>
        <Link href="/review" className="btn-primary mt-6 flex min-h-16 text-lg">
          오늘 복습 시작
        </Link>
      </section>

      {stats.total === 0 ? (
        <EmptyState
          title="아직 저장된 레슨이 없습니다"
          body="수업에서 배운 표현을 LLM에게 말하고, 초안을 확인한 뒤 '이대로 앱에 넣어줘'처럼 명시적으로 승인하면 여기에 나타납니다."
          actionHref="/lessons"
          actionLabel="레슨 보관함 보기"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/lessons" className="btn-secondary flex min-h-16">
            최근 레슨 보기
          </Link>
          <Link href="/review/confusing" className="btn-ghost flex min-h-16 items-center justify-center">
            헷갈린 표현만 보기
          </Link>
        </div>
      )}

      {recentLessons.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-ink">최근 레슨</h2>
            <Link href="/lessons" className="text-sm font-bold text-teal-700">
              전체 보기
            </Link>
          </div>
          <div className="space-y-3">
            {recentLessons.map((lesson) => (
              <Link key={lesson.id} href={`/lessons/${lesson.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{lesson.lesson_date ?? "날짜 없음"}</p>
                <h3 className="mt-2 text-xl font-black text-ink">{lesson.title}</h3>
                <p className="mt-2 text-sm text-slate-600">표현 {lesson.items.length}개 · {lesson.source_note ?? "LLM 정리"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {queue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-black text-ink">다음 복습 후보</h2>
          <div className="space-y-3">
            {queue.map((item) => (
              <Link key={item.id} href={`/items/${item.id}`} className="block rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-ink">{item.expression}</h3>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.meaning_ko}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!hasIngestionEnv() ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          LLM ingestion API 환경 변수가 아직 설정되지 않았습니다. 앱 복습은 가능하지만, 배포 환경에서 LLM이 레슨을 넣으려면 INGESTION_API_TOKEN과 INGESTION_OWNER_ID가 필요합니다.
        </div>
      ) : null}
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

function EnvWarning() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      Supabase 환경 변수가 아직 설정되지 않았습니다. 로컬 사용은 `.env.example`을 `.env.local`로 복사해 설정하세요.
    </div>
  );
}
