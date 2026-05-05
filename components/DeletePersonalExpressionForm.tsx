"use client";

import { useState } from "react";

import { deletePersonalExpressionAction } from "@/app/actions";

export function DeletePersonalExpressionForm({ expressionId }: { expressionId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="rounded-full border border-red-100 bg-white px-3 py-1.5 text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50">
        삭제
      </button>
    );
  }

  return (
    <form action={deletePersonalExpressionAction.bind(null, expressionId)} className="flex items-center gap-2">
      <span className="text-xs font-bold text-red-700">진짜 삭제할까요?</span>
      <button type="submit" className="rounded-full bg-red-600 px-3 py-1.5 text-white shadow-sm transition hover:bg-red-700">삭제</button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 shadow-sm transition hover:border-slate-300">취소</button>
    </form>
  );
}
