import { describe, expect, it } from "vitest";

import { scheduleReviewQueue } from "@/lib/scheduling";
import type { StudyCard } from "@/lib/types";

function card(overrides: Partial<StudyCard>): StudyCard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    owner_id: "user-a",
    english_text: "Could you elaborate?",
    korean_meaning: "자세히 설명해 주실 수 있나요?",
    grammar_note: "Polite request pattern",
    status: "new",
    last_reviewed_at: null,
    review_count: 0,
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    examples: [],
    ...overrides
  };
}

describe("scheduleReviewQueue", () => {
  it("prioritizes confusing cards before new and known cards", () => {
    const queue = scheduleReviewQueue([
      card({ id: "known", status: "known" }),
      card({ id: "new", status: "new" }),
      card({ id: "confusing", status: "confusing" })
    ]);

    expect(queue.map((item) => item.id)).toEqual(["confusing", "new", "known"]);
  });

  it("sorts least-recently-reviewed cards first within the same status", () => {
    const queue = scheduleReviewQueue([
      card({ id: "recent", status: "confusing", last_reviewed_at: "2026-04-28T03:00:00.000Z" }),
      card({ id: "never", status: "confusing", last_reviewed_at: null }),
      card({ id: "older", status: "confusing", last_reviewed_at: "2026-04-27T03:00:00.000Z" })
    ]);

    expect(queue.map((item) => item.id)).toEqual(["never", "older", "recent"]);
  });

  it("keeps daily queues small and configurable", () => {
    const cards = Array.from({ length: 12 }, (_, index) => card({ id: String(index), status: "new" }));
    expect(scheduleReviewQueue(cards, 5)).toHaveLength(5);
  });
});
