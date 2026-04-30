import type { ExpressionCard } from "@/lib/types";

type MemorizationCandidate = Pick<ExpressionCard, "id" | "unknown_count" | "known_count" | "last_reviewed_at" | "last_result" | "source_order" | "due_at" | "interval_days"> &
  Partial<Pick<ExpressionCard, "created_at">>;

type ReviewSchedulingState = Pick<MemorizationCandidate, "interval_days" | "last_result" | "last_reviewed_at">;

const DEFAULT_LIMIT = 300;
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;
const KNOWN_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

function koreanDateKey(date: Date) {
  return new Date(date.getTime() + KOREA_TIME_OFFSET_MS).toISOString().slice(0, 10);
}

function koreanMidnightAfterDays(now: Date, intervalDays: number) {
  const koreaNow = new Date(now.getTime() + KOREA_TIME_OFFSET_MS);
  const daysUntilDue = Math.max(1, intervalDays);
  return new Date(Date.UTC(koreaNow.getUTCFullYear(), koreaNow.getUTCMonth(), koreaNow.getUTCDate() + daysUntilDue) - KOREA_TIME_OFFSET_MS);
}

function isSameKoreanDay(a: Date, b: Date) {
  return koreanDateKey(a) === koreanDateKey(b);
}

function reviewedOnSameKoreanDay(reviewedAt: string | null | undefined, now: Date) {
  if (!reviewedAt) return false;
  const reviewed = new Date(reviewedAt);
  return Number.isFinite(reviewed.getTime()) && isSameKoreanDay(reviewed, now);
}

function timeRank(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function reviewedRank(card: MemorizationCandidate): number {
  return timeRank(card.last_reviewed_at, Number.NEGATIVE_INFINITY);
}

function dueRank(card: MemorizationCandidate): number {
  return timeRank(card.due_at, Number.NEGATIVE_INFINITY);
}

function createdRank(card: MemorizationCandidate): number {
  return timeRank(card.created_at, 0);
}

export function isExpressionDue(card: MemorizationCandidate, now = new Date()) {
  if (!card.last_reviewed_at) return true;

  const lastReviewed = new Date(card.last_reviewed_at);
  if (!Number.isFinite(lastReviewed.getTime())) return true;

  if (!card.due_at) return card.last_result === "known" ? !isSameKoreanDay(lastReviewed, now) : true;

  const dueAt = Date.parse(card.due_at);
  if (!Number.isFinite(dueAt)) return true;
  return dueAt <= now.getTime();
}

export function nextKnownIntervalDays(currentIntervalDays: number) {
  if (currentIntervalDays <= 0) return 3;
  return KNOWN_INTERVAL_DAYS.find((intervalDays) => intervalDays > currentIntervalDays) ?? KNOWN_INTERVAL_DAYS[KNOWN_INTERVAL_DAYS.length - 1];
}

export function lapsedIntervalDays(currentIntervalDays: number) {
  if (currentIntervalDays <= 0) return 0;
  return [...KNOWN_INTERVAL_DAYS].reverse().find((intervalDays) => intervalDays < currentIntervalDays) ?? KNOWN_INTERVAL_DAYS[0];
}

export function nextDueAtForUnknown() {
  // Unknown cards stay due; the active review session moves them to the back until remembered.
  return null;
}

export function nextDueAtForKnown(intervalDays: number, now = new Date()) {
  return koreanMidnightAfterDays(now, intervalDays).toISOString();
}

export function nextExpressionReviewSchedule(current: ReviewSchedulingState, result: "known" | "unknown", now = new Date()) {
  if (result === "unknown") {
    const alreadyFailedToday = current.last_result === "unknown" && reviewedOnSameKoreanDay(current.last_reviewed_at, now);
    const intervalDays = alreadyFailedToday ? current.interval_days : lapsedIntervalDays(current.interval_days);
    return { intervalDays, dueAt: nextDueAtForUnknown() };
  }

  const intervalDays = current.last_result === "unknown" ? Math.max(current.interval_days, KNOWN_INTERVAL_DAYS[0]) : nextKnownIntervalDays(current.interval_days);
  return { intervalDays, dueAt: nextDueAtForKnown(intervalDays, now) };
}

export function compareExpressionsForMemorization<T extends MemorizationCandidate>(a: T, b: T) {
  const unknownDelta = b.unknown_count - a.unknown_count;
  if (unknownDelta !== 0) return unknownDelta;

  const unseenDelta = Number(!b.last_reviewed_at) - Number(!a.last_reviewed_at);
  if (unseenDelta !== 0) return unseenDelta;

  const aDue = dueRank(a);
  const bDue = dueRank(b);
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;

  const knownDelta = a.known_count - b.known_count;
  if (knownDelta !== 0) return knownDelta;

  const aReviewed = reviewedRank(a);
  const bReviewed = reviewedRank(b);
  if (aReviewed !== bReviewed) return aReviewed < bReviewed ? -1 : 1;

  return a.source_order - b.source_order || createdRank(a) - createdRank(b);
}

export function scheduleMemorizationQueue<T extends MemorizationCandidate>(cards: T[], limit = DEFAULT_LIMIT, now = new Date()) {
  return [...cards].filter((card) => isExpressionDue(card, now)).sort(compareExpressionsForMemorization).slice(0, limit);
}

export const scheduleMemorizeQueue = scheduleMemorizationQueue;
export const scheduleReviewQueue = scheduleMemorizationQueue;
