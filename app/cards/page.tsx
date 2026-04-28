import Link from "next/link";

import { DeleteCardButton } from "@/components/DeleteCardButton";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { requireCurrentUser } from "@/lib/auth";
import { getCardStore } from "@/lib/card-store";
import type { CardStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["all", "new", "known", "confusing"]);
const filterLabels = { all: "전체", new: "새 카드", known: "알고 있음", confusing: "헷갈림" } as const;

type SearchParams = Promise<{ status?: string }>;

export default async function CardsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const requestedStatus = params.status ?? "all";
  const status = allowedStatuses.has(requestedStatus) ? (requestedStatus as CardStatus | "all") : "all";
  const cards = await getCardStore(user).listCards({ status });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">카드 보관함</p>
          <h1 className="mt-2 text-3xl font-black text-ink">내 복습 카드</h1>
        </div>
        <Link href="/cards/new" className="btn-primary inline-flex justify-center">
          새 카드
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "new", "known", "confusing"] as const).map((filter) => (
          <Link key={filter} href={filter === "all" ? "/cards" : `/cards?status=${filter}`} className={`rounded-full px-4 py-2 text-sm font-black ${status === filter ? "bg-ink text-white" : "bg-white text-slate-700"}`}>
            {filterLabels[filter]}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState title="아직 카드가 없습니다" body="수업에서 배운 문장, 뜻, 이론 메모, 예문을 추가하세요." actionHref="/cards/new" actionLabel="카드 만들기" />
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <article key={card.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-card">
              <Link href={`/cards/${card.id}/edit`} aria-label={`${card.english_text} 수정`} className="block rounded-3xl focus:outline-none focus:ring-4 focus:ring-teal-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusPill status={card.status} />
                    <h2 className="mt-3 text-xl font-black leading-snug text-ink">{card.english_text}</h2>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">#{card.review_count}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{card.korean_meaning}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-teal-700">카드를 눌러 수정</p>
              </Link>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/cards/${card.id}/edit`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">
                  수정
                </Link>
                <DeleteCardButton cardId={card.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
