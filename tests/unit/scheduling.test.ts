import { describe, expect, it } from "vitest";

import { lapsedIntervalDays, nextDueAtForKnown, nextExpressionReviewSchedule, nextKnownIntervalDays, scheduleMemorizationQueue } from "@/lib/scheduling";
import type { ExpressionCard } from "@/lib/types";

function card(overrides: Partial<ExpressionCard>): ExpressionCard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    expression_day_id: "day-a",
    owner_id: "user-a",
    english: "have to ~",
    korean_prompt: "~해야 한다",
    nuance_note: null,
    structure_note: null,
    grammar_note: null,
    user_memo: null,
    source_order: 0,
    known_count: 0,
    unknown_count: 0,
    review_count: 0,
    last_result: null,
    last_reviewed_at: null,
    due_at: null,
    interval_days: 0,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    examples: [],
    ...overrides
  };
}

const now = new Date("2026-04-28T12:00:00.000Z");

describe("scheduleMemorizationQueue", () => {
  it("only includes new or due expressions", () => {
    const queue = scheduleMemorizationQueue(
      [
        card({ id: "new", last_reviewed_at: null, due_at: null }),
        card({ id: "due", last_reviewed_at: "2026-04-27T12:00:00.000Z", due_at: "2026-04-28T11:59:00.000Z" }),
        card({ id: "future", last_reviewed_at: "2026-04-28T11:00:00.000Z", due_at: "2026-04-29T11:00:00.000Z" })
      ],
      10,
      now
    );
    expect(queue.map((candidate) => candidate.id)).toEqual(["new", "due"]);
  });

  it("honors future due_at for remembered cards even after the Korean day changes", () => {
    const queue = scheduleMemorizationQueue(
      [
        card({ id: "known-future", known_count: 3, last_result: "known", last_reviewed_at: "2026-04-28T14:50:00.000Z", due_at: "2026-05-05T15:00:00.000Z", interval_days: 7 }),
        card({ id: "known-due", known_count: 3, last_result: "known", last_reviewed_at: "2026-04-21T14:50:00.000Z", due_at: "2026-04-28T11:00:00.000Z", interval_days: 7 }),
        card({ id: "forgotten", unknown_count: 1, last_result: "unknown", last_reviewed_at: "2026-04-28T11:30:00.000Z", due_at: null, interval_days: 7 })
      ],
      10,
      new Date("2026-04-29T15:01:00.000Z")
    );
    expect(queue.map((candidate) => candidate.id)).toEqual(["forgotten", "known-due"]);
  });

  it("keeps old remembered rows without due_at out until the next Korean day", () => {
    const sameDayQueue = scheduleMemorizationQueue(
      [card({ id: "same-day-known", known_count: 1, last_result: "known", last_reviewed_at: "2026-04-28T11:30:00.000Z", due_at: null, interval_days: 1 })],
      10,
      now
    );
    expect(sameDayQueue).toEqual([]);

    const nextDayQueue = scheduleMemorizationQueue(
      [card({ id: "previous-day-known", known_count: 1, last_result: "known", last_reviewed_at: "2026-04-28T14:50:00.000Z", due_at: null, interval_days: 1 })],
      10,
      new Date("2026-04-28T15:01:00.000Z")
    );
    expect(nextDayQueue.map((candidate) => candidate.id)).toEqual(["previous-day-known"]);
  });

  it("prioritizes higher cumulative unknown_count first among due cards", () => {
    const queue = scheduleMemorizationQueue(
      [
        card({ id: "low", unknown_count: 1, due_at: "2026-04-28T11:50:00.000Z", last_reviewed_at: "2026-04-28T10:00:00.000Z" }),
        card({ id: "high", unknown_count: 3, due_at: "2026-04-28T11:55:00.000Z", last_reviewed_at: "2026-04-28T10:00:00.000Z" }),
        card({ id: "none", unknown_count: 0, due_at: "2026-04-28T11:00:00.000Z", last_reviewed_at: "2026-04-28T10:00:00.000Z" })
      ],
      10,
      now
    );
    expect(queue.map((candidate) => candidate.id)).toEqual(["high", "low", "none"]);
  });

  it("boosts never-reviewed expressions, then due time, then known_count", () => {
    const queue = scheduleMemorizationQueue(
      [
        card({ id: "known-many", known_count: 4, last_reviewed_at: "2026-04-27T00:00:00.000Z", due_at: "2026-04-28T11:00:00.000Z" }),
        card({ id: "never", known_count: 0, last_reviewed_at: null, due_at: null }),
        card({ id: "known-once", known_count: 1, last_reviewed_at: "2026-04-26T00:00:00.000Z", due_at: "2026-04-28T10:00:00.000Z" })
      ],
      10,
      now
    );
    expect(queue.map((candidate) => candidate.id)).toEqual(["never", "known-once", "known-many"]);
  });

  it("uses source order as the final stable tie-breaker", () => {
    const queue = scheduleMemorizationQueue([card({ id: "second", source_order: 2 }), card({ id: "first", source_order: 1 })], 10, now);
    expect(queue.map((candidate) => candidate.id)).toEqual(["first", "second"]);
  });

  it("keeps queues small and configurable", () => {
    const cards = Array.from({ length: 312 }, (_, index) => card({ id: String(index), source_order: index }));
    expect(scheduleMemorizationQueue(cards, 5, now)).toHaveLength(5);
    expect(scheduleMemorizationQueue(cards, undefined, now)).toHaveLength(300);
  });
});

describe("Anki-lite interval policy", () => {
  it("promotes immediate recalls through the bounded interval ladder", () => {
    expect(nextKnownIntervalDays(0)).toBe(3);
    expect(nextKnownIntervalDays(1)).toBe(3);
    expect(nextKnownIntervalDays(3)).toBe(7);
    expect(nextKnownIntervalDays(7)).toBe(14);
    expect(nextKnownIntervalDays(14)).toBe(30);
    expect(nextKnownIntervalDays(30)).toBe(30);
  });

  it("demotes lapses by one interval without dropping learned cards below one day", () => {
    expect(lapsedIntervalDays(0)).toBe(0);
    expect(lapsedIntervalDays(1)).toBe(1);
    expect(lapsedIntervalDays(3)).toBe(1);
    expect(lapsedIntervalDays(7)).toBe(3);
    expect(lapsedIntervalDays(14)).toBe(7);
    expect(lapsedIntervalDays(30)).toBe(14);
  });

  it("sets remembered cards due on the selected future Korean-midnight boundary", () => {
    expect(nextDueAtForKnown(1, new Date("2026-04-28T14:50:00.000Z"))).toBe("2026-04-28T15:00:00.000Z");
    expect(nextDueAtForKnown(3, new Date("2026-04-28T14:50:00.000Z"))).toBe("2026-04-30T15:00:00.000Z");
    expect(nextDueAtForKnown(7, new Date("2026-04-28T15:01:00.000Z"))).toBe("2026-05-05T15:00:00.000Z");
  });

  it("schedules new immediate recalls three days out and recovered new lapses one day out", () => {
    const direct = nextExpressionReviewSchedule(card({ id: "direct-new" }), "known", now);
    expect(direct).toEqual({ intervalDays: 3, dueAt: "2026-04-30T15:00:00.000Z" });

    const recovered = nextExpressionReviewSchedule(card({ id: "recovered-new", last_result: "unknown", last_reviewed_at: "2026-04-28T11:30:00.000Z", interval_days: 0 }), "known", now);
    expect(recovered).toEqual({ intervalDays: 1, dueAt: "2026-04-28T15:00:00.000Z" });
  });

  it("demotes only the first same-day unknown and does not promote after unresolved lapses", () => {
    const firstUnknown = nextExpressionReviewSchedule(card({ id: "mature", last_result: "known", last_reviewed_at: "2026-04-21T12:00:00.000Z", interval_days: 14 }), "unknown", now);
    expect(firstUnknown).toEqual({ intervalDays: 7, dueAt: null });

    const repeatedUnknown = nextExpressionReviewSchedule(card({ id: "mature", last_result: "unknown", last_reviewed_at: "2026-04-28T11:30:00.000Z", interval_days: 7 }), "unknown", now);
    expect(repeatedUnknown).toEqual({ intervalDays: 7, dueAt: null });

    const recovered = nextExpressionReviewSchedule(card({ id: "mature", last_result: "unknown", last_reviewed_at: "2026-04-28T11:30:00.000Z", interval_days: 7 }), "known", now);
    expect(recovered).toEqual({ intervalDays: 7, dueAt: "2026-05-04T15:00:00.000Z" });
  });
});
