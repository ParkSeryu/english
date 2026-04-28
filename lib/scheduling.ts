import type { StudyItem } from "@/lib/types";

const statusPriority: Record<StudyItem["status"], number> = {
  confusing: 0,
  new: 1,
  learning: 2,
  memorized: 3
};

function reviewedRank(item: StudyItem): number {
  if (!item.last_reviewed_at) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(item.last_reviewed_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function compareItemsForReview(a: StudyItem, b: StudyItem) {
  const statusDelta = statusPriority[a.status] - statusPriority[b.status];
  if (statusDelta !== 0) return statusDelta;

  const reviewedDelta = reviewedRank(a) - reviewedRank(b);
  if (reviewedDelta !== 0) return reviewedDelta;

  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function scheduleReviewQueue(items: StudyItem[], limit = 10) {
  return [...items].sort(compareItemsForReview).slice(0, limit);
}
