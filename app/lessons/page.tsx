import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { requireCurrentUser } from "@/lib/auth";
import { getLessonStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const user = await requireCurrentUser();
  const lessons = await getLessonStore(user).listLessons();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">레슨 보관함</p>
        <h1 className="mt-2 text-3xl font-black text-ink">LLM이 정리한 수업 내용</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">앱에서 직접 입력하지 않고, LLM 초안 확인과 명시적 승인 후 저장된 레슨만 보여줍니다.</p>
      </div>

      {lessons.length === 0 ? (
        <EmptyState title="아직 레슨이 없습니다" body="LLM에게 배운 내용을 말하고 초안을 확인한 뒤 저장을 승인하면 레슨이 여기에 쌓입니다." actionHref="/review" actionLabel="복습 화면 보기" />
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
              <Link href={`/lessons/${lesson.id}`} className="block rounded-3xl focus:outline-none focus:ring-4 focus:ring-teal-100">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{lesson.lesson_date ?? "날짜 없음"}</p>
                <h2 className="mt-3 text-xl font-black leading-snug text-ink">{lesson.title}</h2>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{lesson.raw_input}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">표현 {lesson.items.length}개 · {lesson.source_note ?? "LLM 정리"}</p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
