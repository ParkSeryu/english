"use client";

import type { ReactNode } from "react";
import { Fragment, useState, useTransition } from "react";

import { recordExpressionReviewAction, recordExpressionReviewInPlaceAction } from "@/app/actions";
import type { ExpressionCard } from "@/lib/types";

type MemorizeCardProps = {
  expression: ExpressionCard;
  returnTo?: string;
  onReviewSubmit?: (result: "known" | "unknown") => void;
};

export function MemorizeCard({ expression, returnTo = "/memorize", onReviewSubmit }: MemorizeCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [, startTransition] = useTransition();

  function handleReview(result: "known" | "unknown") {
    if (result === "unknown") setRevealed(false);

    if (onReviewSubmit) {
      onReviewSubmit(result);
      startTransition(() => {
        void recordExpressionReviewInPlaceAction(expression.id, result).catch((error: unknown) => {
          console.error("Failed to record expression review", error);
        });
      });
      return;
    }

    startTransition(() => {
      void recordExpressionReviewAction(expression.id, result, returnTo);
    });
  }

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>외움 {expression.known_count}회</span>
        <span>틀림 {expression.unknown_count}회</span>
      </div>

      {!revealed ? (
        <div className="mt-6 rounded-3xl bg-ink p-5 text-white shadow-lg shadow-slate-200">
          <p className="text-sm font-black text-teal-200">한국어를 보고 영어로 말하기</p>
          <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{expression.korean_prompt}</h1>
          <button type="button" onClick={() => setRevealed(true)} className="mt-5 min-h-14 w-full rounded-full bg-teal-600 px-5 py-3 text-center text-base font-black text-white transition hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200" aria-expanded="false">정답 보기</button>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-[1.75rem] bg-gradient-to-br from-ink to-slate-800 p-5 text-white shadow-lg shadow-slate-200">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-200">영어 정답</p>
            <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{expression.english}</h1>
            <div className="my-5 h-px bg-white/15" />
            <p className="whitespace-pre-wrap text-lg font-semibold leading-7 text-slate-100">{expression.korean_prompt}</p>
          </div>
          <div className="mt-5 space-y-4" aria-live="polite">
            {expression.grammar_note ? <Info title="문법/패턴" body={<GrammarPatternNote body={expression.grammar_note} />} /> : null}
            {expression.examples.length > 0 ? (
              <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
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
              <button type="button" onClick={() => handleReview("unknown")} className="min-h-14 w-full rounded-full border border-rose-200 bg-rose-50 px-5 py-3 font-black text-rose-700 transition hover:bg-rose-100">모름</button>
              <button type="button" onClick={() => handleReview("known")} className="min-h-14 w-full rounded-full bg-emerald-600 px-5 py-3 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700">외웠음</button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function Info({ title, body }: { title: string; body: ReactNode }) {
  return <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4"><h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2><div className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{body}</div></section>;
}

function GrammarPatternNote({ body }: { body: string }) {
  return body.split("\n").map((line, index) => {
    const labeledLine = line.match(/^([\s★]*)(문법|패턴):(.*)$/u);
    const lineBreak = index > 0 ? "\n" : null;

    if (labeledLine) {
      const [, starPrefix, label, rest] = labeledLine;

      return (
        <Fragment key={`${index}-${line}`}>
          {lineBreak}
          {starPrefix}
          <strong className="rounded-full bg-teal-100 px-2 py-0.5 font-black text-teal-800">{label}</strong>
          {renderMeaningSeparator(rest)}
        </Fragment>
      );
    }

    return <Fragment key={`${index}-${line}`}>{lineBreak}{renderMeaningSeparator(line)}</Fragment>;
  });
}

function renderMeaningSeparator(text: string) {
  const separatedMeaning = text.match(/^(\s*)(.*?) = (.*)$/u);

  if (!separatedMeaning) return text;

  return (
    <>
      {separatedMeaning[1]}
      <span className="inline-flex flex-wrap items-center gap-1.5 align-baseline">
        <span>{separatedMeaning[2]}</span>
        <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-black leading-none text-slate-500" aria-label="뜻">
          →
        </span>
        <span>{separatedMeaning[3]}</span>
      </span>
    </>
  );
}
