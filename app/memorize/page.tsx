import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { MemorizeCard } from "@/components/MemorizeCard";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

export default async function MemorizePage() {
  const user = await requireCurrentUser();
  const queue = await getExpressionStore(user).getMemorizationQueue({ limit: 10 });
  const nextExpression = queue[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">암기 큐</p><h1 className="mt-2 text-3xl font-black text-ink">한국어 → 영어 떠올리기</h1><p className="mt-3 text-sm leading-6 text-slate-600">모름 횟수가 많은 표현, 아직 안 본 표현, 덜 맞춘 표현 순서로 보여줍니다.</p></div><Link href="/expressions" className="btn-ghost inline-flex justify-center">표현 목록</Link></div>
      {nextExpression ? <><MemorizeCard expression={nextExpression} /><p className="text-center text-sm font-semibold text-slate-500">오늘 암기 큐에 {queue.length}개 표현이 있습니다.</p></> : <EmptyState title="암기할 표현이 없습니다" body="LLM 초안을 승인하면 한국어 프롬프트로 외울 표현이 생깁니다." actionHref="/expressions" actionLabel="표현 보관함 보기" />}
    </div>
  );
}
