import { describe, expect, it } from "vitest";

import { scheduleReviewQueue } from "@/lib/scheduling";
import type { StudyItem } from "@/lib/types";

function item(overrides: Partial<StudyItem>): StudyItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    lesson_id: "lesson-a",
    owner_id: "user-a",
    expression: "have to ~",
    meaning_ko: "~해야 한다",
    core_nuance: "의무나 필요성",
    structure_note: "have to + 동사원형",
    grammar_note: "3인칭 단수는 has to",
    user_memo: null,
    confusion_note: null,
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
  it("prioritizes confusing, new, learning, then memorized items", () => {
    const queue = scheduleReviewQueue([
      item({ id: "memorized", status: "memorized" }),
      item({ id: "learning", status: "learning" }),
      item({ id: "new", status: "new" }),
      item({ id: "confusing", status: "confusing" })
    ]);

    expect(queue.map((candidate) => candidate.id)).toEqual(["confusing", "new", "learning", "memorized"]);
  });

  it("sorts least-recently-reviewed items first within the same status", () => {
    const queue = scheduleReviewQueue([
      item({ id: "recent", status: "confusing", last_reviewed_at: "2026-04-28T03:00:00.000Z" }),
      item({ id: "never", status: "confusing", last_reviewed_at: null }),
      item({ id: "older", status: "confusing", last_reviewed_at: "2026-04-27T03:00:00.000Z" })
    ]);

    expect(queue.map((candidate) => candidate.id)).toEqual(["never", "older", "recent"]);
  });

  it("keeps daily queues small and configurable", () => {
    const items = Array.from({ length: 12 }, (_, index) => item({ id: String(index), status: "new" }));
    expect(scheduleReviewQueue(items, 5)).toHaveLength(5);
  });
});
