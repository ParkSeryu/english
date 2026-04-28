import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { ReviewCard } from "@/components/ReviewCard";
import { requireCurrentUser } from "@/lib/auth";
import { getLessonStore } from "@/lib/lesson-store";
import { reviewModeSchema } from "@/lib/validation";

type SearchParams = Promise<{ mode?: string }>;

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const parsedMode = reviewModeSchema.safeParse(params.mode);
  const mode = parsedMode.success ? parsedMode.data : "meaning-to-expression";
  const queue = await getLessonStore(user).getReviewQueue({ limit: 10 });
  const nextItem = queue[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">가리고 복습</p>
          <h1 className="mt-2 text-3xl font-black text-ink">오늘의 복습 큐</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">헷갈린 표현이 먼저 나오고, 그 다음 아직 안 봤거나 오래 전에 본 표현이 나옵니다.</p>
        </div>
        <Link href="/review/confusing" className="btn-ghost inline-flex justify-center">
          헷갈린 표현만
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <ModeLink href="/review?mode=meaning-to-expression" active={mode === "meaning-to-expression"} label="뜻→표현" />
        <ModeLink href="/review?mode=expression-to-meaning" active={mode === "expression-to-meaning"} label="표현→뜻" />
        <ModeLink href="/review?mode=structure-to-pattern" active={mode === "structure-to-pattern"} label="구조→패턴" />
      </div>

      {nextItem ? (
        <>
          <ReviewCard item={nextItem} mode={mode} />
          <p className="text-center text-sm font-semibold text-slate-500">오늘 복습 큐에 {queue.length}개 표현이 있습니다.</p>
        </>
      ) : (
        <EmptyState title="복습할 표현이 없습니다" body="LLM에게 배운 내용을 말하고, 초안을 확인한 뒤 저장을 승인하면 복습할 표현이 생깁니다." actionHref="/lessons" actionLabel="레슨 보관함 보기" />
      )}
    </div>
  );
}

function ModeLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-black ${active ? "bg-ink text-white" : "bg-white text-slate-700"}`}>
      {label}
    </Link>
  );
}
