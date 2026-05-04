import { describe, expect, it } from "vitest";

import { getExpressionDueLabel } from "@/lib/expression-due-label";

const now = new Date("2026-05-04T08:00:00.000Z");

describe("getExpressionDueLabel", () => {
  it("hides due copy for expressions excluded from memorization", () => {
    expect(getExpressionDueLabel({ is_memorization_enabled: false, due_at: null }, now)).toBeNull();
  });

  it("marks missing or past due dates as due today", () => {
    expect(getExpressionDueLabel({ is_memorization_enabled: true, due_at: null }, now)).toBe("암기 카드 · 오늘 복습");
    expect(getExpressionDueLabel({ is_memorization_enabled: true, due_at: "2026-05-04T07:59:59.000Z" }, now)).toBe("암기 카드 · 오늘 복습");
  });

  it("formats the next future due day in Korea time", () => {
    expect(getExpressionDueLabel({ is_memorization_enabled: true, due_at: "2026-05-05T15:00:00.000Z" }, now)).toBe("암기 카드 · 다음 복습 5월 6일 (수)");
  });
});
