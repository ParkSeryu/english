import { updateQuestionStatusAction } from "@/app/actions";
import { QuestionNoteEditor } from "@/components/QuestionNoteEditor";
import { QuestionNoteForm } from "@/components/QuestionNoteForm";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";
import type { QuestionNoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const questionStatusDisplay: Record<QuestionNoteStatus, { label: string; className: string }> = {
  open: { label: "질문 예정", className: "bg-amber-100 text-amber-800" },
  asked: { label: "물어봄", className: "bg-sky-100 text-sky-800" },
  answered: { label: "답변 받음", className: "bg-emerald-100 text-emerald-800" }
};

export default async function QuestionsPage() {
  const user = await requireCurrentUser();
  const questions = await getExpressionStore(user).listQuestionNotes();

  return (
    <div className="space-y-5">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">질문거리</p><h1 className="mt-2 text-3xl font-black text-ink">수업 질문 메모</h1><p className="mt-3 text-sm leading-6 text-slate-600">수업 전에 질문을 적고, 물어본 뒤 답변까지 이어서 기록합니다.</p></div>
      <QuestionNoteForm />
      <section className="space-y-3">
        {questions.map((question) => {
          const status = questionStatusDisplay[question.status];
          const nextQuickStatus = question.status === "open" ? "asked" : "open";
          return (
            <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-base font-bold leading-7 text-ink">{question.question_text}</p>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
              </div>
              {question.answer_note ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">답변 메모</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.answer_note}</p>
                </div>
              ) : null}
              <QuestionNoteEditor question={question} />
              <form action={updateQuestionStatusAction.bind(null, question.id, nextQuickStatus)} className="mt-4">
                <button type="submit" className="btn-ghost w-full">{question.status === "open" ? "물어봄으로 표시" : "다시 질문 예정"}</button>
              </form>
            </article>
          );
        })}
        {questions.length === 0 ? <p className="rounded-3xl bg-white p-5 text-center text-sm font-semibold text-slate-500 shadow-sm">아직 질문거리가 없습니다.</p> : null}
      </section>
    </div>
  );
}
