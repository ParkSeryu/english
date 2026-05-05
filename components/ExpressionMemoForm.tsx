"use client";

import { useActionState } from "react";

import { updateExpressionMemoAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, ExpressionCard } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function ExpressionMemoForm({ expression, showMemorizationToggle = true }: { expression: ExpressionCard; showMemorizationToggle?: boolean }) {
  const [state, formAction, pending] = useActionState(updateExpressionMemoAction.bind(null, expression.id), initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="userMemo">내 메모</label>
        <textarea id="userMemo" name="userMemo" defaultValue={expression.user_memo ?? ""} rows={4} className="input min-h-28" placeholder="선생님께 물어볼 점, 내가 외우고 싶은 포인트" />
        <FieldError messages={state.fieldErrors?.userMemo} />
      </div>
      {showMemorizationToggle ? (
        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
          <input type="checkbox" name="isMemorizationEnabled" defaultChecked={expression.is_memorization_enabled} className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600" />
          <span><span className="block text-ink">암기카드에 넣기</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">끄면 표현 목록에는 남지만 내 암기 큐에는 나오지 않습니다.</span></span>
        </label>
      ) : expression.is_memorization_enabled ? (
        <input type="hidden" name="isMemorizationEnabled" value="on" />
      ) : null}
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "저장 중…" : "저장"}</button>
    </form>
  );
}
