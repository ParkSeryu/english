import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { TopicFilterSelect } from "@/components/TopicFilterSelect";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";
import { sortExpressionsByPriority } from "@/lib/expression-priority";
import type { ExpressionDay } from "@/lib/types";

export const dynamic = "force-dynamic";

type ExpressionDayListItem = ExpressionDay & {
  folder_path?: string[] | string | null;
  folderPath?: string | null;
  folder?: {
    path?: string | null;
    name?: string | null;
  };
};

type SearchParams = Promise<{ day?: string; topic?: string }>;

export default async function ExpressionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const days = await getExpressionStore(user).listExpressionDays() as ExpressionDayListItem[];
  const requestedTopicId = params.topic ?? params.day;
  const requestedTopicBlocked = Boolean(requestedTopicId && !days.some((day) => day.id === requestedTopicId));
  const selectedTopicId = pickSelectedTopicId(days, requestedTopicId);
  const selectedDay = days.find((day) => day.id === selectedTopicId) ?? null;
  const topicOptions = days.map((day) => ({
    id: day.id,
    label: getTopicDisplayLabel(day),
    depth: getTopicDepth(day)
  }));
  const visibleDays = selectedDay ? [{ ...selectedDay, expressions: sortExpressionsByPriority(selectedDay.expressions) }] : [];

  return (
    <div className="space-y-5">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">표현</p><h1 className="mt-2 text-3xl font-black text-ink">표현 모아보기</h1><p className="mt-3 text-sm leading-6 text-slate-600">토픽을 하나 골라 배운 표현만 깔끔하게 확인하세요.</p></div>
      {visibleDays.length === 0 ? <EmptyState title="아직 표현이 없습니다" body="배운 표현이 생기면 토픽별로 여기에 쌓입니다." actionHref="/memorize" actionLabel="암기 화면 보기" /> : (
        <div className="space-y-5">
          {requestedTopicBlocked ? (
            <p className="text-sm text-amber-700" role="status" aria-live="polite">요청한 토픽에는 접근할 수 없어서 첫 번째 토픽으로 이동했습니다.</p>
          ) : null}
          <TopicFilterSelect options={topicOptions} selectedId={selectedTopicId ?? visibleDays[0].id} />
          {visibleDays.map((day) => (
            <section key={day.id} className="space-y-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{day.day_date ?? "날짜 없음"}</p><h2 className="mt-1 text-2xl font-black text-ink">{day.title}</h2><p className="mt-1 text-sm text-slate-600">{day.source_note ?? "학습 노트"}</p></div>
              {day.expressions.map((expression) => (
                <Link key={expression.id} href={`/expressions/${expression.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
                  <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-black text-ink">{expression.english}</h3><div className="shrink-0 space-y-0.5 text-xs font-semibold leading-4 text-slate-500"><div className="flex justify-end gap-1"><span>틀림</span><span className="tabular-nums">{expression.unknown_count}회</span></div><div className="flex justify-end gap-1"><span>외움</span><span className="tabular-nums">{expression.known_count}회</span></div></div></div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{expression.korean_prompt}</p>
                  {expression.grammar_note ? <p className="mt-3 text-sm leading-6 text-slate-700"><span className="font-black text-slate-500">문법/패턴</span> {expression.grammar_note}</p> : null}
                  {expression.examples.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      <p className="font-black text-slate-500">비슷한 표현</p>
                      {expression.examples.map((example) => (
                        <div key={example.id}>
                          <p className="font-semibold text-ink">{example.example_text}</p>
                          {example.meaning_ko ? <p className="text-slate-600">{example.meaning_ko}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function pickSelectedTopicId(days: { id: string }[], requestedId?: string) {
  if (requestedId && days.some((day) => day.id === requestedId)) return requestedId;
  return days[0]?.id ?? null;
}

function getFolderPath(day: ExpressionDayListItem): string | null {
  if (Array.isArray(day.folder_path)) return day.folder_path.join(" / ");
  return day.folder_path ?? day.folderPath ?? day.folder?.path ?? null;
}

function getTopicDepth(day: ExpressionDayListItem): number {
  const path = getFolderPath(day);
  if (!path) return 0;
  const separators = path.split("/");
  if (!separators[0]) return 0;
  return Math.max(0, separators.length - 1);
}

function getTopicDisplayLabel(day: ExpressionDayListItem) {
  const folderPath = getFolderPath(day);
  return folderPath ? `${folderPath} / ${day.title}` : day.title;
}
