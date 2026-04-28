"use client";

import { useActionState } from "react";

import { updateItemNotesAction } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionState, StudyItem } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function ItemNotesForm({ item }: { item: StudyItem }) {
  const [state, formAction, pending] = useActionState(updateItemNotesAction.bind(null, item.id), initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="userMemo">
          내 메모
        </label>
        <textarea id="userMemo" name="userMemo" defaultValue={item.user_memo ?? ""} rows={4} className="input min-h-28" placeholder="선생님이 강조한 말, 내가 외우고 싶은 포인트" />
        <FieldError messages={state.fieldErrors?.userMemo} />
      </div>
      <div>
        <label className="label" htmlFor="confusionNote">
          헷갈린 점
        </label>
        <textarea id="confusionNote" name="confusionNote" defaultValue={item.confusion_note ?? ""} rows={4} className="input min-h-28" placeholder="비슷한 표현, 자주 틀리는 구조, 질문" />
        <FieldError messages={state.fieldErrors?.confusionNote} />
      </div>
      {state.message ? <p className={`rounded-2xl p-3 text-sm font-medium ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중…" : "메모 저장"}
      </button>
    </form>
  );
}
