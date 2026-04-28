import type { ExpressionCard } from "@/lib/types";

function reviewedRank(card: ExpressionCard): number {
  if (!card.last_reviewed_at) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(card.last_reviewed_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function compareExpressionsForMemorization(a: ExpressionCard, b: ExpressionCard) {
  const unknownDelta = b.unknown_count - a.unknown_count;
  if (unknownDelta !== 0) return unknownDelta;

  const unseenDelta = Number(!b.last_reviewed_at) - Number(!a.last_reviewed_at);
  if (unseenDelta !== 0) return unseenDelta;

  const knownDelta = a.known_count - b.known_count;
  if (knownDelta !== 0) return knownDelta;

  const reviewedDelta = reviewedRank(a) - reviewedRank(b);
  if (reviewedDelta !== 0) return reviewedDelta;

  return a.source_order - b.source_order || Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function scheduleMemorizationQueue(cards: ExpressionCard[], limit = 10) {
  return [...cards].sort(compareExpressionsForMemorization).slice(0, limit);
}

export const scheduleReviewQueue = scheduleMemorizationQueue;
