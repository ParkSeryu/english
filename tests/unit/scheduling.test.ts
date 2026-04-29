import { describe, expect, it } from "vitest";

import { nextKnownIntervalDays, scheduleMemorizationQueue } from "@/lib/scheduling";
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

  it("uses simple Anki-lite known intervals", () => {
    expect(nextKnownIntervalDays(0)).toBe(1);
    expect(nextKnownIntervalDays(1)).toBe(3);
    expect(nextKnownIntervalDays(3)).toBe(7);
    expect(nextKnownIntervalDays(7)).toBe(14);
    expect(nextKnownIntervalDays(30)).toBe(30);
  });

  it("keeps queues small and configurable", () => {
    const cards = Array.from({ length: 12 }, (_, index) => card({ id: String(index), source_order: index }));
    expect(scheduleMemorizationQueue(cards, 5, now)).toHaveLength(5);
  });
});
