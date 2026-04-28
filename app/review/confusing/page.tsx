import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { ReviewCard } from "@/components/ReviewCard";
import { requireCurrentUser } from "@/lib/auth";
import { getLessonStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function ConfusingReviewPage() {
  const user = await requireCurrentUser();
  const queue = await getLessonStore(user).getReviewQueue({ confusingOnly: true, limit: 10 });
  const nextItem = queue[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">헷갈린 표현 복습</p>
          <h1 className="mt-2 text-3xl font-black text-ink">약한 표현 다시 연습하기</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">헷갈린다고 표시한 표현만 빠르게 다시 보여줍니다.</p>
        </div>
        <Link href="/review" className="btn-ghost inline-flex justify-center">
          전체 큐 보기
        </Link>
      </div>

      {nextItem ? (
        <ReviewCard item={nextItem} mode="meaning-to-expression" returnTo="/review/confusing" />
      ) : (
        <EmptyState title="헷갈린 표현이 없습니다" body="헷갈린다고 표시한 표현이 여기에 나타나고, 오늘의 복습 큐에서 우선순위가 높아집니다." actionHref="/review" actionLabel="복습으로 돌아가기" />
      )}
    </div>
  );
}
