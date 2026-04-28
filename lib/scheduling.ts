import type { ExpressionCard } from "@/lib/types";

type MemorizationCandidate = Pick<ExpressionCard, "id" | "unknown_count" | "known_count" | "last_reviewed_at" | "last_result" | "source_order"> &
  Partial<Pick<ExpressionCard, "created_at">>;

const KNOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

function isKnownCoolingDown(card: MemorizationCandidate, now: Date) {
  if (card.last_result !== "known" || card.known_count <= 0 || card.unknown_count > 0 || !card.last_reviewed_at) return false;
  const lastReviewed = Date.parse(card.last_reviewed_at);
  if (!Number.isFinite(lastReviewed)) return false;
  return now.getTime() - lastReviewed < KNOWN_COOLDOWN_MS;
}

export function scheduleMemorizationQueue<T extends MemorizationCandidate>(cards: T[], limit = 10, now = new Date()) {
  return [...cards].filter((card) => !isKnownCoolingDown(card, now)).sort(compareExpressionsForMemorization).slice(0, limit);
}

export const scheduleMemorizeQueue = scheduleMemorizationQueue;
export const scheduleReviewQueue = scheduleMemorizationQueue;
