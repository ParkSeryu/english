"use client";

import { useActionState } from "react";

import { createPersonalExpressionAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function PersonalExpressionForm() {
  const [state, formAction, pending] = useActionState(createPersonalExpressionAction, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="english">영어 표현</label>
        <textarea id="english" name="english" rows={3} className="input min-h-24" placeholder="예: I'm trying to cut down on sugar." required />
        <FieldError messages={state.fieldErrors?.english} />
      </div>
      <div>
        <label className="label" htmlFor="koreanPrompt">한국어 뜻 / 암기 프롬프트</label>
        <textarea id="koreanPrompt" name="koreanPrompt" rows={3} className="input min-h-24" placeholder="예: 설탕을 줄이려고 노력하고 있어요." required />
        <FieldError messages={state.fieldErrors?.koreanPrompt} />
      </div>
      <div>
        <label className="label" htmlFor="grammarNote">문법/패턴 메모</label>
        <textarea id="grammarNote" name="grammarNote" rows={3} className="input min-h-24" placeholder="예: cut down on + 명사 = ~을 줄이다" />
        <FieldError messages={state.fieldErrors?.grammarNote} />
      </div>
      <div>
        <label className="label" htmlFor="userMemo">내 메모</label>
        <textarea id="userMemo" name="userMemo" rows={3} className="input min-h-24" placeholder="나만 보는 메모" />
        <FieldError messages={state.fieldErrors?.userMemo} />
      </div>
      <label className="flex items-start gap-3 rounded-2xl bg-teal-50 p-4 text-sm font-bold text-teal-900">
        <input type="checkbox" name="isMemorizationEnabled" defaultChecked className="mt-1 h-4 w-4 rounded border-teal-300 text-teal-600" />
        <span><span className="block">저장하면서 암기카드에 넣기</span><span className="mt-1 block text-xs font-medium leading-5 text-teal-700">끄면 내 표현 목록에만 저장되고 암기 큐에는 나오지 않습니다.</span></span>
      </label>
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "저장 중…" : "내 표현 저장"}</button>
    </form>
  );
}
