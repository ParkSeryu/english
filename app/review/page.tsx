import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { ReviewCard } from "@/components/ReviewCard";
import { requireCurrentUser } from "@/lib/auth";
import { getCardStore } from "@/lib/card-store";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireCurrentUser();
  const queue = await getCardStore(user).getReviewQueue({ limit: 10 });
  const nextCard = queue[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">가리고 복습</p>
          <h1 className="mt-2 text-3xl font-black text-ink">오늘의 복습 큐</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">헷갈린 카드가 먼저 나오고, 그 다음 가장 오래 전에 본 카드가 나옵니다.</p>
        </div>
        <Link href="/review/confusing" className="btn-ghost inline-flex justify-center">
          헷갈린 카드만
        </Link>
      </div>

      {nextCard ? (
        <>
          <ReviewCard card={nextCard} />
          <p className="text-center text-sm font-semibold text-slate-500">오늘 복습 큐에 {queue.length}장이 있습니다.</p>
        </>
      ) : (
        <EmptyState title="복습할 카드가 없습니다" body="먼저 카드를 만든 뒤, 내용을 가리고 떠올리는 복습을 시작하세요." actionHref="/cards/new" actionLabel="카드 만들기" />
      )}
    </div>
  );
}
