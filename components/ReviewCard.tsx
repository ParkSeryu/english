"use client";

import { useMemo, useState } from "react";

import { markItemStatusAction } from "@/app/actions";
import { StatusPill } from "@/components/StatusPill";
import type { ReviewMode, StudyItem } from "@/lib/types";

const modeLabels: Record<ReviewMode, string> = {
  "meaning-to-expression": "뜻 보고 표현 떠올리기",
  "expression-to-meaning": "표현 보고 뜻 떠올리기",
  "structure-to-pattern": "구조 보고 패턴 떠올리기"
};

export function ReviewCard({ item, mode = "meaning-to-expression", returnTo = "/review" }: { item: StudyItem; mode?: ReviewMode; returnTo?: string }) {
  const [revealed, setRevealed] = useState(false);
  const learningAction = useMemo(() => markItemStatusAction.bind(null, item.id, "learning", returnTo), [item.id, returnTo]);
  const memorizedAction = useMemo(() => markItemStatusAction.bind(null, item.id, "memorized", returnTo), [item.id, returnTo]);
  const confusingAction = useMemo(() => markItemStatusAction.bind(null, item.id, "confusing", returnTo), [item.id, returnTo]);

  const prompt = getPrompt(item, mode);

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={item.status} />
        <span className="text-xs font-semibold text-slate-500">{item.review_count}회 복습</span>
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-6 block w-full rounded-3xl bg-ink p-5 text-left text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200"
          aria-expanded="false"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">{modeLabels[mode]}</p>
          <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{prompt}</h1>
          <span className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-center text-base font-black text-white">
            정답 보기
          </span>
        </button>
      ) : (
        <>
          <div className="mt-6 rounded-3xl bg-ink p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">정답</p>
            <h1 className="mt-3 whitespace-pre-wrap text-2xl font-black leading-tight">{item.expression}</h1>
          </div>
          <div className="mt-5 space-y-4" aria-live="polite">
            <section className="rounded-3xl bg-slate-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">한국어 뜻</h2>
              <p className="mt-2 whitespace-pre-wrap text-lg font-semibold text-ink">{item.meaning_ko}</p>
            </section>
            {item.core_nuance ? (
              <section className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">느낌 / 뉘앙스</h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{item.core_nuance}</p>
              </section>
            ) : null}
            {item.structure_note ? (
              <section className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">구조</h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{item.structure_note}</p>
              </section>
            ) : null}
            {item.grammar_note ? (
              <section className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">문법 / 수업 메모</h2>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{item.grammar_note}</p>
              </section>
            ) : null}
            <section className="rounded-3xl bg-slate-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">예문</h2>
              <ul className="mt-2 space-y-2">
                {item.examples.map((example) => (
                  <li key={example.id} className="rounded-2xl bg-white p-3 text-slate-700">
                    <p>{example.example_text}</p>
                    {example.meaning_ko ? <p className="mt-1 text-sm text-slate-500">{example.meaning_ko}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <form action={learningAction}>
                <button type="submit" className="btn-ghost min-h-14 w-full">
                  다시 학습
                </button>
              </form>
              <form action={memorizedAction}>
                <button type="submit" className="btn-secondary min-h-14 w-full">
                  암기했어요
                </button>
              </form>
              <form action={confusingAction}>
                <button type="submit" className="min-h-14 w-full rounded-full bg-amber-500 px-5 py-3 font-black text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600">
                  아직 헷갈려요
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </article>
  );
}

function getPrompt(item: StudyItem, mode: ReviewMode) {
  if (mode === "expression-to-meaning") return item.expression;
  if (mode === "structure-to-pattern") return item.structure_note || item.core_nuance || item.meaning_ko;
  return [item.meaning_ko, item.core_nuance].filter(Boolean).join("\n");
}
