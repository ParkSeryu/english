import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string }>;

export default async function ExpressionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const days = await getExpressionStore(user).listExpressionDays();
  const visibleDays = params.day ? days.filter((day) => day.id === params.day) : days;

  return (
    <div className="space-y-5">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">표현 보관함</p><h1 className="mt-2 text-3xl font-black text-ink">매일 배운 영어 문장</h1><p className="mt-3 text-sm leading-6 text-slate-600">LLM 초안 확인과 명시적 승인 후 저장된 표현만 보여줍니다.</p></div>
      {visibleDays.length === 0 ? <EmptyState title="아직 표현이 없습니다" body="LLM 초안을 승인하면 날짜별 표현 묶음이 여기에 쌓입니다." actionHref="/memorize" actionLabel="암기 화면 보기" /> : (
        <div className="space-y-5">
          {visibleDays.map((day) => (
            <section key={day.id} className="space-y-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{day.day_date ?? "날짜 없음"}</p><h2 className="mt-1 text-2xl font-black text-ink">{day.title}</h2><p className="mt-1 text-sm text-slate-600">{day.source_note ?? "LLM 정리"}</p></div>
              {day.expressions.map((expression) => (
                <Link key={expression.id} href={`/expressions/${expression.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
                  <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black text-ink">{expression.english}</h3><span className="shrink-0 text-xs font-semibold text-slate-500">모름 {expression.unknown_count}</span></div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{expression.korean_prompt}</p>
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
