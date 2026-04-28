import type { StudyCard } from "@/lib/types";

const statusPriority: Record<StudyCard["status"], number> = {
  confusing: 0,
  new: 1,
  known: 2
};

function reviewedRank(card: StudyCard): number {
  if (!card.last_reviewed_at) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(card.last_reviewed_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function compareCardsForReview(a: StudyCard, b: StudyCard) {
  const statusDelta = statusPriority[a.status] - statusPriority[b.status];
  if (statusDelta !== 0) return statusDelta;

  const reviewedDelta = reviewedRank(a) - reviewedRank(b);
  if (reviewedDelta !== 0) return reviewedDelta;

  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function scheduleReviewQueue(cards: StudyCard[], limit = 10) {
  return [...cards].sort(compareCardsForReview).slice(0, limit);
}
