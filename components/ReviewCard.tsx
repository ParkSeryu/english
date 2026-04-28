"use client";

import { useState } from "react";

import { markConfusingAction, markKnownAction, markKnownFromConfusingAction } from "@/app/actions";
import { StatusPill } from "@/components/StatusPill";
import type { StudyCard } from "@/lib/types";

export function ReviewCard({ card, confusingOnly = false }: { card: StudyCard; confusingOnly?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const knownAction = confusingOnly ? markKnownFromConfusingAction.bind(null, card.id) : markKnownAction.bind(null, card.id);
  const confusingAction = markConfusingAction.bind(null, card.id);

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={card.status} />
        <span className="text-xs font-semibold text-slate-500">{card.review_count}회 복습</span>
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-6 block w-full rounded-3xl bg-ink p-5 text-left text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200"
          aria-expanded="false"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">표현을 떠올려보세요</p>
          <h1 className="mt-3 text-2xl font-black leading-tight">{card.english_text}</h1>
          <span className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-center text-base font-black text-white">
            카드를 눌러 정답 보기
          </span>
        </button>
      ) : (
        <>
          <div className="mt-6 rounded-3xl bg-ink p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">표현을 떠올려보세요</p>
            <h1 className="mt-3 text-2xl font-black leading-tight">{card.english_text}</h1>
          </div>
          <div className="mt-5 space-y-4" aria-live="polite">
          <section className="rounded-3xl bg-slate-50 p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">한국어 뜻</h2>
            <p className="mt-2 whitespace-pre-wrap text-lg font-semibold text-ink">{card.korean_meaning}</p>
          </section>
          <section className="rounded-3xl bg-slate-50 p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">문법 / 이론 메모</h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{card.grammar_note}</p>
          </section>
          <section className="rounded-3xl bg-slate-50 p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">예문</h2>
            <ul className="mt-2 space-y-2">
              {card.examples.map((example) => (
                <li key={example.id} className="rounded-2xl bg-white p-3 text-slate-700">
                  {example.example_text}
                </li>
              ))}
            </ul>
          </section>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form action={knownAction}>
              <button type="submit" className="btn-secondary min-h-14 w-full">
                알고 있었어요
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
