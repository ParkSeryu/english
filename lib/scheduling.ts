import type { ExpressionCard } from "@/lib/types";

type MemorizationCandidate = Pick<ExpressionCard, "id" | "unknown_count" | "known_count" | "last_reviewed_at" | "last_result" | "source_order" | "due_at" | "interval_days"> &
  Partial<Pick<ExpressionCard, "created_at">>;

const DEFAULT_LIMIT = 300;
const MAX_INTERVAL_DAYS = 30;
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

function koreanDateKey(date: Date) {
  return new Date(date.getTime() + KOREA_TIME_OFFSET_MS).toISOString().slice(0, 10);
}

function nextKoreanMidnight(now: Date) {
  const koreaNow = new Date(now.getTime() + KOREA_TIME_OFFSET_MS);
  return new Date(Date.UTC(koreaNow.getUTCFullYear(), koreaNow.getUTCMonth(), koreaNow.getUTCDate() + 1) - KOREA_TIME_OFFSET_MS);
}

function isSameKoreanDay(a: Date, b: Date) {
  return koreanDateKey(a) === koreanDateKey(b);
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

  if (card.last_result === "known") return !isSameKoreanDay(lastReviewed, now);

  if (!card.due_at) return true;

  const dueAt = Date.parse(card.due_at);
  if (!Number.isFinite(dueAt)) return true;
  return dueAt <= now.getTime();
}

export function nextKnownIntervalDays(currentIntervalDays: number) {
  if (currentIntervalDays <= 0) return 1;
  if (currentIntervalDays < 3) return 3;
  if (currentIntervalDays < 7) return 7;
  return Math.min(currentIntervalDays * 2, MAX_INTERVAL_DAYS);
}

export function nextDueAtForUnknown() {
  // Unknown cards stay due; the active review session moves them to the back until remembered.
  return null;
}

export function nextDueAtForKnown(_intervalDays: number, now = new Date()) {
  return nextKoreanMidnight(now).toISOString();
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
