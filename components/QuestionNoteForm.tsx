"use client";

import { useActionState } from "react";

import { createQuestionNoteAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function QuestionNoteForm() {
  const [state, formAction, pending] = useActionState(createQuestionNoteAction, initialState);
  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="questionText">질문거리</label>
        <textarea id="questionText" name="questionText" rows={3} className="input min-h-24" placeholder="다음 수업에서 물어볼 표현/문법 질문" />
        <FieldError messages={state.fieldErrors?.questionText} />
      </div>
      <div>
        <label className="label" htmlFor="answerNote">답변 메모 (선택)</label>
        <textarea id="answerNote" name="answerNote" rows={3} className="input min-h-24" placeholder="이미 받은 답변이나 힌트" />
        <FieldError messages={state.fieldErrors?.answerNote} />
      </div>
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "추가 중…" : "질문 추가"}</button>
    </form>
  );
}
