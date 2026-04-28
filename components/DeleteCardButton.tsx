"use client";

import { useTransition } from "react";

import { deleteCardAction } from "@/app/actions";

export function DeleteCardButton({ cardId }: { cardId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("이 카드와 예문을 삭제할까요?")) {
          startTransition(() => void deleteCardAction(cardId));
        }
      }}
      className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
    >
      {pending ? "삭제 중…" : "삭제"}
    </button>
  );
}
