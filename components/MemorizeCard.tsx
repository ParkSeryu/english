"use client";

import { useMemo, useState } from "react";

import { recordExpressionReviewAction } from "@/app/actions";
import type { ExpressionCard } from "@/lib/types";

export function MemorizeCard({ expression, returnTo = "/memorize", onReviewSubmit }: { expression: ExpressionCard; returnTo?: string; onReviewSubmit?: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const knownAction = useMemo(() => recordExpressionReviewAction.bind(null, expression.id, "known", returnTo), [expression.id, returnTo]);
  const unknownAction = useMemo(() => recordExpressionReviewAction.bind(null, expression.id, "unknown", returnTo), [expression.id, returnTo]);

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>외움 {expression.known_count}회</span>
        <span>모름 {expression.unknown_count}회</span>
      </div>

      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className="mt-6 block w-full rounded-3xl bg-ink p-5 text-left text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200" aria-expanded="false">
          <p className="text-sm font-black text-teal-200">한국어를 보고 영어로 말하기</p>
          <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{expression.korean_prompt}</h1>
          <span className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-center text-base font-black text-white">정답 보기</span>
        </button>
      ) : (
        <>
          <div className="mt-6 rounded-3xl bg-ink p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">영어 정답</p>
            <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{expression.english}</h1>
          </div>
          <div className="mt-5 space-y-4" aria-live="polite">
            <section className="rounded-3xl bg-slate-50 p-4">
              <p className="whitespace-pre-wrap text-lg font-semibold text-ink">{expression.korean_prompt}</p>
            </section>
            {expression.grammar_note ? <Info title="문법/패턴" body={expression.grammar_note} /> : null}
            {expression.examples.length > 0 ? (
              <section className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">비슷한 표현</h2>
                <ul className="mt-2 space-y-2">
                  {expression.examples.map((example) => (
                    <li key={example.id} className="rounded-2xl bg-white p-3 text-slate-700">
                      <p>{example.example_text}</p>
                      {example.meaning_ko ? <p className="mt-1 text-sm text-slate-500">{example.meaning_ko}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <form action={unknownAction} onSubmit={() => { setRevealed(false); onReviewSubmit?.(); }}><button type="submit" className="min-h-14 w-full rounded-full bg-red-500 px-5 py-3 font-black text-white shadow-lg shadow-red-100 transition hover:bg-red-600">모름</button></form>
              <form action={knownAction} onSubmit={onReviewSubmit}><button type="submit" className="min-h-14 w-full rounded-full bg-emerald-600 px-5 py-3 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700">외웠음</button></form>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return <section className="rounded-3xl bg-slate-50 p-4"><h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{body}</p></section>;
}
