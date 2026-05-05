import { describe, expect, it } from "vitest";

import { sortExpressionsByPriority } from "@/lib/expression-priority";

type Candidate = {
  id: string;
  unknown_count: number;
  known_count: number;
  source_order: number;
  can_delete?: boolean;
};

function expression(overrides: Partial<Candidate> & { id: string }): Candidate {
  return {
    unknown_count: 0,
    known_count: 0,
    source_order: 0,
    ...overrides
  };
}

describe("expression priority sorting", () => {
  it("moves more wrong answers upward and more remembered answers downward", () => {
    const sorted = sortExpressionsByPriority([
      expression({ id: "remembered", unknown_count: 0, known_count: 5, source_order: 0 }),
      expression({ id: "mixed-more-remembered", unknown_count: 2, known_count: 3, source_order: 1 }),
      expression({ id: "mixed-less-remembered", unknown_count: 2, known_count: 1, source_order: 2 }),
      expression({ id: "hard", unknown_count: 3, known_count: 0, source_order: 3 }),
      expression({ id: "new", unknown_count: 0, known_count: 0, source_order: 4 })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["hard", "mixed-less-remembered", "mixed-more-remembered", "new", "remembered"]);
  });

  it("lists directly added personal expressions before shared expressions", () => {
    const sorted = sortExpressionsByPriority([
      expression({ id: "shared-hard", unknown_count: 5, known_count: 0, source_order: 0 }),
      expression({ id: "personal-newer", can_delete: true, unknown_count: 0, known_count: 0, source_order: 2 }),
      expression({ id: "personal-older", can_delete: true, unknown_count: 0, known_count: 0, source_order: 1 })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["personal-older", "personal-newer", "shared-hard"]);
  });

  it("uses source order when review counts are tied", () => {
    const sorted = sortExpressionsByPriority([
      expression({ id: "second", unknown_count: 1, known_count: 2, source_order: 2 }),
      expression({ id: "first", unknown_count: 1, known_count: 2, source_order: 1 })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["first", "second"]);
  });
});
