"use client";

import { useActionState } from "react";

import { updateExpressionMemoAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, ExpressionCard } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function ExpressionMemoForm({ expression }: { expression: ExpressionCard }) {
  const [state, formAction, pending] = useActionState(updateExpressionMemoAction.bind(null, expression.id), initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="userMemo">내 메모</label>
        <textarea id="userMemo" name="userMemo" defaultValue={expression.user_memo ?? ""} rows={4} className="input min-h-28" placeholder="선생님께 물어볼 점, 내가 외우고 싶은 포인트" />
        <FieldError messages={state.fieldErrors?.userMemo} />
      </div>
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "저장 중…" : "메모 저장"}</button>
    </form>
  );
}
