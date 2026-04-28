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
        <span>맞춤 {expression.known_count}회</span>
        <span>모름 {expression.unknown_count}회</span>
      </div>

      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className="mt-6 block w-full rounded-3xl bg-ink p-5 text-left text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200" aria-expanded="false">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">한국어를 보고 영어 문장을 떠올리기</p>
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
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">한국어 프롬프트</h2>
              <p className="mt-2 whitespace-pre-wrap text-lg font-semibold text-ink">{expression.korean_prompt}</p>
            </section>
            {expression.nuance_note ? <Info title="느낌 / 뉘앙스" body={expression.nuance_note} /> : null}
            {expression.structure_note ? <Info title="구조" body={expression.structure_note} /> : null}
            {expression.grammar_note ? <Info title="문법 / 수업 메모" body={expression.grammar_note} /> : null}
            {expression.examples.length > 0 ? (
              <section className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">예문</h2>
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
              <form action={knownAction} onSubmit={onReviewSubmit}><button type="submit" className="btn-secondary min-h-14 w-full">맞췄음</button></form>
              <form action={unknownAction} onSubmit={() => { setRevealed(false); onReviewSubmit?.(); }}><button type="submit" className="min-h-14 w-full rounded-full bg-amber-500 px-5 py-3 font-black text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600">모름</button></form>
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
