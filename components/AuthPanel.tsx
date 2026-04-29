"use client";

import { useActionState, useState } from "react";

import { resetPasswordAction, signInAction, signUpAction } from "@/app/actions";

const initialState = { ok: false, message: "" };

type AuthMode = "sign-in" | "sign-up" | "help";

function FeedbackMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  return <p className={`mt-3 text-sm leading-6 ${ok ? "text-emerald-700" : "text-red-700"}`}>{message}</p>;
}

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [signInState, signIn, signInPending] = useActionState(signInAction, initialState);
  const [signUpState, signUp, signUpPending] = useActionState(signUpAction, initialState);
  const [resetState, resetPassword, resetPending] = useActionState(resetPasswordAction, initialState);

  return (
    <section className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-card sm:px-6" aria-label="인증">
      {mode === "sign-in" ? (
        <form action={signIn}>
          <h2 className="text-center text-2xl font-black text-ink">로그인</h2>

          <label className="mt-7 block text-sm font-semibold text-slate-700" htmlFor="signin-email">
            이메일
          </label>
          <input id="signin-email" name="email" type="email" autoComplete="email" required className="input" />

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="signin-password">
            비밀번호
          </label>
          <input id="signin-password" name="password" type="password" autoComplete="current-password" required className="input" />

          <FeedbackMessage ok={Boolean(signInState.ok)} message={signInState.message} />

          <button type="submit" disabled={Boolean(signInPending)} className="btn-primary mt-5 w-full">
            {signInPending ? "로그인 중…" : "로그인"}
          </button>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setMode("help")} className="text-sm font-bold text-slate-500 underline-offset-4 hover:text-teal-700 hover:underline">
              아이디·비밀번호 찾기
            </button>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            아직 계정이 없나요?{" "}
            <button type="button" onClick={() => setMode("sign-up")} className="font-black text-teal-700 underline-offset-4 hover:underline">
              회원가입
            </button>
          </div>
        </form>
      ) : null}

      {mode === "sign-up" ? (
        <form action={signUp}>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-ink">회원가입</h2>
            <p className="text-sm leading-6 text-slate-500">이메일과 6자 이상 비밀번호만 있으면 시작할 수 있어요.</p>
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="signup-email">
            이메일
          </label>
          <input id="signup-email" name="email" type="email" autoComplete="email" required className="input" />

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="signup-password">
            비밀번호
          </label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={6} required className="input" />

          <FeedbackMessage ok={Boolean(signUpState.ok)} message={signUpState.message} />

          <button type="submit" disabled={Boolean(signUpPending)} className="btn-primary mt-5 w-full">
            {signUpPending ? "계정 생성 중…" : "회원가입"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            이미 계정이 있나요?{" "}
            <button type="button" onClick={() => setMode("sign-in")} className="font-black text-teal-700 underline-offset-4 hover:underline">
              로그인
            </button>
          </p>
        </form>
      ) : null}

      {mode === "help" ? (
        <form action={resetPassword}>
          <div className="space-y-1">
            <p className="text-sm font-bold text-teal-700">계정을 찾고 있나요?</p>
            <h2 className="text-2xl font-black text-ink">아이디·비밀번호 찾기</h2>
            <p className="text-sm leading-6 text-slate-500">이 앱은 이메일을 아이디로 사용해요. 가입한 이메일을 입력하면 비밀번호 재설정 메일을 보내드립니다.</p>
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="reset-email">
            가입한 이메일
          </label>
          <input id="reset-email" name="email" type="email" autoComplete="email" required className="input" />

          <FeedbackMessage ok={Boolean(resetState.ok)} message={resetState.message} />

          <button type="submit" disabled={Boolean(resetPending)} className="btn-primary mt-5 w-full">
            {resetPending ? "메일 보내는 중…" : "비밀번호 재설정 메일 받기"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            기억났나요?{" "}
            <button type="button" onClick={() => setMode("sign-in")} className="font-black text-teal-700 underline-offset-4 hover:underline">
              로그인으로 돌아가기
            </button>
          </p>
        </form>
      ) : null}
    </section>
  );
}
