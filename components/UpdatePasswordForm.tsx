"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updatePasswordAction } from "@/app/actions";

const initialState = { ok: false, message: "" };

function FeedbackMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  return <p className={`mt-3 text-sm leading-6 ${ok ? "text-emerald-700" : "text-red-700"}`}>{message}</p>;
}

export function UpdatePasswordForm() {
  const [state, updatePassword, pending] = useActionState(updatePasswordAction, initialState);

  if (state.ok) {
    return (
      <section className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-card sm:px-6" aria-label="비밀번호 변경 완료">
        <p className="text-sm font-bold text-teal-700">비밀번호 재설정</p>
        <h1 className="mt-1 text-2xl font-black text-ink">변경 완료</h1>
        <FeedbackMessage ok={Boolean(state.ok)} message={state.message} />
        <Link href="/login" className="btn-primary mt-5 w-full">
          로그인하러 가기
        </Link>
      </section>
    );
  }

  return (
    <form action={updatePassword} className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-card sm:px-6" aria-label="새 비밀번호 설정">
      <div className="space-y-1">
        <p className="text-sm font-bold text-teal-700">비밀번호 재설정</p>
        <h1 className="text-2xl font-black text-ink">새 비밀번호 설정</h1>
        <p className="text-sm leading-6 text-slate-500">메일 링크 확인이 끝났습니다. 앞으로 사용할 새 비밀번호를 입력해 주세요.</p>
      </div>

      <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="new-password">
        새 비밀번호
      </label>
      <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={6} required className="input" />

      <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="confirm-password">
        새 비밀번호 확인
      </label>
      <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required className="input" />

      <FeedbackMessage ok={Boolean(state.ok)} message={state.message} />

      <button type="submit" disabled={Boolean(pending)} className="btn-primary mt-5 w-full">
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
