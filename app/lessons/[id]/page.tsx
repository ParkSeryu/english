import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/StatusPill";
import { requireCurrentUser } from "@/lib/auth";
import { getLessonStore } from "@/lib/lesson-store";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function LessonDetailPage({ params }: { params: Params }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const lesson = await getLessonStore(user).getLesson(id);
  if (!lesson) notFound();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">{lesson.lesson_date ?? "날짜 없음"}</p>
        <h1 className="mt-2 text-3xl font-black text-ink">{lesson.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{lesson.source_note ?? "LLM이 정리한 레슨"}</p>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-card">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">원본 수업 메모</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lesson.raw_input}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black text-ink">표현 {lesson.items.length}개</h2>
        {lesson.items.map((item) => (
          <Link key={item.id} href={`/items/${item.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <StatusPill status={item.status} />
                <h3 className="mt-3 text-xl font-black text-ink">{item.expression}</h3>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{item.review_count}회</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.meaning_ko}</p>
            {item.core_nuance ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.core_nuance}</p> : null}
          </Link>
        ))}
      </section>
    </div>
  );
}
