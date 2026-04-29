"use client";

import { useActionState } from "react";

import { updateQuestionNoteAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, QuestionNote } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function QuestionNoteEditor({ question }: { question: QuestionNote }) {
  const [state, formAction, pending] = useActionState(updateQuestionNoteAction.bind(null, question.id), initialState);

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-black text-teal-700">수정 / 답변 추가</summary>
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor={`questionText-${question.id}`}>
            질문거리
          </label>
          <textarea
            id={`questionText-${question.id}`}
            name="questionText"
            rows={3}
            className="input min-h-24 bg-white"
            defaultValue={question.question_text}
          />
          <FieldError messages={state.fieldErrors?.questionText} />
        </div>

        <div>
          <label className="label" htmlFor={`status-${question.id}`}>
            상태
          </label>
          <select id={`status-${question.id}`} name="status" className="input bg-white" defaultValue={question.status}>
            <option value="open">질문 예정</option>
            <option value="asked">물어봄</option>
            <option value="answered">답변 받음</option>
          </select>
          <FieldError messages={state.fieldErrors?.status} />
        </div>

        <div>
          <label className="label" htmlFor={`answerNote-${question.id}`}>
            답변 메모
          </label>
          <textarea
            id={`answerNote-${question.id}`}
            name="answerNote"
            rows={4}
            className="input min-h-28 bg-white"
            placeholder="답변을 받은 뒤 여기에 추가로 적어두세요"
            defaultValue={question.answer_note ?? ""}
          />
          <FieldError messages={state.fieldErrors?.answerNote} />
        </div>

        {state.message ? (
          <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {state.message}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "저장 중…" : "수정 내용 저장"}
        </button>
      </form>
    </details>
  );
}
