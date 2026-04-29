import { EmptyState } from "@/components/EmptyState";
import { MemorizeQueue } from "@/components/MemorizeQueue";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ defer?: string }>;

export default async function MemorizePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const queue = await getExpressionStore(user).getMemorizationQueue({ limit: 300 });
  const deferredIds = parseDeferredIds(params.defer);
  const displayQueue = moveDeferredExpressionsToEnd(queue, deferredIds);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black leading-tight tracking-[-0.03em] text-ink">오늘의 복습</h1>
        {queue.length > 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">복습할 표현 {queue.length}개</p> : null}
      </header>

      {displayQueue.length > 0 ? <MemorizeQueue expressions={displayQueue} deferredIds={deferredIds} /> : <EmptyState title="암기할 표현이 없습니다" body="배운 표현이 생기면 한국어 힌트로 바로 복습할 수 있습니다." actionHref="/expressions" actionLabel="표현 모아보기" />}
    </div>
  );
}

function parseDeferredIds(value?: string) {
  if (!value) return [];
  return [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
}

function moveDeferredExpressionsToEnd<T extends { id: string }>(queue: T[], deferredIds: string[]) {
  if (deferredIds.length === 0) return queue;
  const deferredSet = new Set(deferredIds);
  const active = queue.filter((expression) => !deferredSet.has(expression.id));
  const deferred = deferredIds.flatMap((id) => queue.filter((expression) => expression.id === id));
  return [...active, ...deferred];
}
