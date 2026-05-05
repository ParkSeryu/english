"use client";

import { useActionState, useState } from "react";

import { updatePersonalExpressionAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, ExpressionCard } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function PersonalExpressionEditForm({ expression }: { expression: ExpressionCard }) {
  const [state, formAction, pending] = useActionState(updatePersonalExpressionAction.bind(null, expression.id), initialState);
  const [english, setEnglish] = useState(expression.english);
  const [koreanPrompt, setKoreanPrompt] = useState(expression.korean_prompt);
  const [grammarNote, setGrammarNote] = useState(expression.grammar_note ?? "");
  const [userMemo, setUserMemo] = useState(expression.user_memo ?? "");
  const [isMemorizationEnabled, setIsMemorizationEnabled] = useState(Boolean(expression.is_memorization_enabled));

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="english">영어 표현</label>
        <textarea id="english" name="english" rows={3} value={english} onChange={(event) => setEnglish(event.target.value)} className="input min-h-24" required />
        <FieldError messages={state.fieldErrors?.english} />
      </div>
      <div>
        <label className="label" htmlFor="koreanPrompt">한국어 뜻 / 암기 프롬프트</label>
        <textarea id="koreanPrompt" name="koreanPrompt" rows={3} value={koreanPrompt} onChange={(event) => setKoreanPrompt(event.target.value)} className="input min-h-24" required />
        <FieldError messages={state.fieldErrors?.koreanPrompt} />
      </div>
      <div>
        <label className="label" htmlFor="grammarNote">문법/패턴 메모</label>
        <textarea id="grammarNote" name="grammarNote" rows={3} value={grammarNote} onChange={(event) => setGrammarNote(event.target.value)} className="input min-h-24" />
        <FieldError messages={state.fieldErrors?.grammarNote} />
      </div>
      <div>
        <label className="label" htmlFor="userMemo">내 메모</label>
        <textarea id="userMemo" name="userMemo" rows={3} value={userMemo} onChange={(event) => setUserMemo(event.target.value)} className="input min-h-24" placeholder="나만 보는 메모" />
        <FieldError messages={state.fieldErrors?.userMemo} />
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-teal-50 p-4 text-sm font-bold text-teal-900">
        <input type="checkbox" name="isMemorizationEnabled" checked={isMemorizationEnabled} onChange={(event) => setIsMemorizationEnabled(event.target.checked)} className="mt-1 h-4 w-4 rounded border-teal-300 text-teal-600" />
        <span><span className="block">암기카드에 넣기</span><span className="mt-1 block text-xs font-medium leading-5 text-teal-700">체크하면 내 암기 큐에 나오고, 끄면 표현 목록에만 남습니다.</span></span>
      </label>
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "수정 중…" : "표현 수정"}</button>
    </form>
  );
}
