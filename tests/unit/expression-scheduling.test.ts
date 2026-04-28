import { describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type ExpressionCardForQueue = {
  id: string;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_reviewed_at: string | null;
  source_order: number;
};

type SchedulingModule = {
  scheduleMemorizeQueue: (expressions: ExpressionCardForQueue[], limit?: number) => ExpressionCardForQueue[];
};

function expression(overrides: Partial<ExpressionCardForQueue>): ExpressionCardForQueue {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    unknown_count: 0,
    known_count: 0,
    review_count: 0,
    last_reviewed_at: null,
    source_order: 0,
    ...overrides
  };
}

describe("scheduleMemorizeQueue", () => {
  it("prioritizes unknown-heavy cards before known-heavy cards", async () => {
    const { scheduleMemorizeQueue } = await importModule<SchedulingModule>("@/lib/scheduling");

    const queue = scheduleMemorizeQueue([
      expression({ id: "known-heavy", unknown_count: 0, known_count: 5, review_count: 5, source_order: 0 }),
      expression({ id: "unknown-heavy", unknown_count: 3, known_count: 0, review_count: 3, source_order: 1 }),
      expression({ id: "some-unknown", unknown_count: 1, known_count: 2, review_count: 3, source_order: 2 })
    ]);

    expect(queue.map((candidate) => candidate.id)).toEqual(["unknown-heavy", "some-unknown", "known-heavy"]);
  });

  it("keeps never-reviewed cards visible and tie-breaks by least recently reviewed then source order", async () => {
    const { scheduleMemorizeQueue } = await importModule<SchedulingModule>("@/lib/scheduling");

    const queue = scheduleMemorizeQueue([
      expression({ id: "recent", last_reviewed_at: "2026-04-28T03:00:00.000Z", source_order: 2 }),
      expression({ id: "older", last_reviewed_at: "2026-04-27T03:00:00.000Z", source_order: 1 }),
      expression({ id: "never-first", last_reviewed_at: null, source_order: 0 }),
      expression({ id: "never-second", last_reviewed_at: null, source_order: 3 })
    ]);

    expect(queue.map((candidate) => candidate.id)).toEqual(["never-first", "never-second", "older", "recent"]);
  });

  it("honors the requested queue limit", async () => {
    const { scheduleMemorizeQueue } = await importModule<SchedulingModule>("@/lib/scheduling");
    const queue = scheduleMemorizeQueue(Array.from({ length: 8 }, (_, index) => expression({ id: String(index), source_order: index })), 3);
    expect(queue).toHaveLength(3);
  });
});
