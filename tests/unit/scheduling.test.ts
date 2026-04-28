import { describe, expect, it } from "vitest";

import { scheduleMemorizationQueue } from "@/lib/scheduling";
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
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    examples: [],
    ...overrides
  };
}

describe("scheduleMemorizationQueue", () => {
  it("prioritizes higher unknown_count first", () => {
    const queue = scheduleMemorizationQueue([card({ id: "low", unknown_count: 1 }), card({ id: "high", unknown_count: 3 }), card({ id: "none", unknown_count: 0 })]);
    expect(queue.map((candidate) => candidate.id)).toEqual(["high", "low", "none"]);
  });

  it("boosts never-reviewed expressions, then penalizes high known_count", () => {
    const queue = scheduleMemorizationQueue([
      card({ id: "known-many", known_count: 4, last_reviewed_at: "2026-04-27T00:00:00.000Z" }),
      card({ id: "never", known_count: 0, last_reviewed_at: null }),
      card({ id: "known-once", known_count: 1, last_reviewed_at: "2026-04-26T00:00:00.000Z" })
    ]);
    expect(queue.map((candidate) => candidate.id)).toEqual(["never", "known-once", "known-many"]);
  });

  it("uses source order as the final stable tie-breaker", () => {
    const queue = scheduleMemorizationQueue([card({ id: "second", source_order: 2 }), card({ id: "first", source_order: 1 })]);
    expect(queue.map((candidate) => candidate.id)).toEqual(["first", "second"]);
  });

  it("keeps recently known expressions out of the queue for 24 hours", () => {
    const queue = scheduleMemorizationQueue(
      [
        card({ id: "known-today", known_count: 1, unknown_count: 0, last_result: "known", last_reviewed_at: "2026-04-28T10:00:00.000Z" }),
        card({ id: "known-yesterday", known_count: 1, unknown_count: 0, last_result: "known", last_reviewed_at: "2026-04-27T09:59:59.000Z" }),
        card({ id: "unknown-today", known_count: 0, unknown_count: 1, last_result: "unknown", last_reviewed_at: "2026-04-28T10:00:00.000Z" }),
        card({ id: "never", last_result: null, last_reviewed_at: null })
      ],
      10,
      new Date("2026-04-28T11:00:00.000Z")
    );

    expect(queue.map((candidate) => candidate.id)).toEqual(["unknown-today", "never", "known-yesterday"]);
  });

  it("keeps queues small and configurable", () => {
    const cards = Array.from({ length: 12 }, (_, index) => card({ id: String(index), source_order: index }));
    expect(scheduleMemorizationQueue(cards, 5)).toHaveLength(5);
  });
});
