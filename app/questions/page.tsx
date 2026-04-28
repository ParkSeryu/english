import { updateQuestionStatusAction } from "@/app/actions";
import { QuestionNoteForm } from "@/components/QuestionNoteForm";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const user = await requireCurrentUser();
  const questions = await getExpressionStore(user).listQuestionNotes();

  return (
    <div className="space-y-5">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">질문거리</p><h1 className="mt-2 text-3xl font-black text-ink">다음 수업 질문 메모</h1><p className="mt-3 text-sm leading-6 text-slate-600">가볍게 적고, 물어본 뒤 완료로 넘깁니다. 태그나 복잡한 관리 기능은 넣지 않았습니다.</p></div>
      <QuestionNoteForm />
      <section className="space-y-3">
        {questions.map((question) => (
          <article key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><p className="whitespace-pre-wrap text-base font-bold leading-7 text-ink">{question.question_text}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${question.status === "open" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{question.status === "open" ? "질문 예정" : "물어봄"}</span></div>
            {question.answer_note ? <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{question.answer_note}</p> : null}
            <form action={updateQuestionStatusAction.bind(null, question.id, question.status === "open" ? "asked" : "open")} className="mt-4"><button type="submit" className="btn-ghost w-full">{question.status === "open" ? "물어봄으로 표시" : "다시 질문 예정"}</button></form>
          </article>
        ))}
        {questions.length === 0 ? <p className="rounded-3xl bg-white p-5 text-center text-sm font-semibold text-slate-500 shadow-sm">아직 질문거리가 없습니다.</p> : null}
      </section>
    </div>
  );
}
