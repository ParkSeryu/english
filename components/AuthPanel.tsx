"use client";

import { useActionState } from "react";

import { signInAction, signUpAction } from "@/app/actions";

const initialState = { ok: false, message: "" };

export function AuthPanel() {
  const [signInState, signIn, signInPending] = useActionState(signInAction, initialState);
  const [signUpState, signUp, signUpPending] = useActionState(signUpAction, initialState);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form action={signIn} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-xl font-bold text-ink">로그인</h2>
        <p className="mt-1 text-sm text-slate-600">Supabase 이메일/비밀번호 로그인으로 내 복습 데이터를 보호합니다.</p>
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="signin-email">
          이메일
        </label>
        <input id="signin-email" name="email" type="email" autoComplete="email" required className="input" />
        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="signin-password">
          비밀번호
        </label>
        <input id="signin-password" name="password" type="password" autoComplete="current-password" required className="input" />
        {signInState.message ? (
          <p className={`mt-3 text-sm ${signInState.ok ? "text-emerald-700" : "text-red-700"}`}>{signInState.message}</p>
        ) : null}
        <button type="submit" disabled={signInPending} className="btn-primary mt-5 w-full">
          {signInPending ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <form action={signUp} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-xl font-bold text-ink">계정 만들기</h2>
        <p className="mt-1 text-sm text-slate-600">레슨과 복습 기록을 내 계정에만 저장하려면 계정을 만드세요.</p>
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="signup-email">
          이메일
        </label>
        <input id="signup-email" name="email" type="email" autoComplete="email" required className="input" />
        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="signup-password">
          비밀번호
        </label>
        <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={6} required className="input" />
        {signUpState.message ? (
          <p className={`mt-3 text-sm ${signUpState.ok ? "text-emerald-700" : "text-red-700"}`}>{signUpState.message}</p>
        ) : null}
        <button type="submit" disabled={signUpPending} className="btn-secondary mt-5 w-full">
          {signUpPending ? "계정 생성 중…" : "계정 만들기"}
        </button>
      </form>
    </div>
  );
}
