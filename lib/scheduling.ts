import type { ExpressionCard } from "@/lib/types";

type MemorizationCandidate = Pick<ExpressionCard, "id" | "unknown_count" | "known_count" | "last_reviewed_at" | "source_order"> &
  Partial<Pick<ExpressionCard, "created_at">>;

function reviewedRank(card: MemorizationCandidate): number {
  if (!card.last_reviewed_at) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(card.last_reviewed_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function createdRank(card: MemorizationCandidate): number {
  if (!card.created_at) return 0;
  const timestamp = Date.parse(card.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function compareExpressionsForMemorization<T extends MemorizationCandidate>(a: T, b: T) {
  const unknownDelta = b.unknown_count - a.unknown_count;
  if (unknownDelta !== 0) return unknownDelta;

  const unseenDelta = Number(!b.last_reviewed_at) - Number(!a.last_reviewed_at);
  if (unseenDelta !== 0) return unseenDelta;

  const knownDelta = a.known_count - b.known_count;
  if (knownDelta !== 0) return knownDelta;

  const aReviewed = reviewedRank(a);
  const bReviewed = reviewedRank(b);
  if (aReviewed !== bReviewed) return aReviewed < bReviewed ? -1 : 1;

  return a.source_order - b.source_order || createdRank(a) - createdRank(b);
}

export function scheduleMemorizationQueue<T extends MemorizationCandidate>(cards: T[], limit = 10) {
  return [...cards].sort(compareExpressionsForMemorization).slice(0, limit);
}

export const scheduleMemorizeQueue = scheduleMemorizationQueue;
export const scheduleReviewQueue = scheduleMemorizationQueue;
