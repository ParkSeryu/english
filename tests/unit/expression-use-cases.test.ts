import { describe, expect, it, vi } from "vitest";

import { createPersonalExpression, deletePersonalExpression, recordExpressionReview } from "@/lib/use-cases/expressions";
import type { ExpressionStore } from "@/lib/lesson-store";

function storeStub(overrides: Record<string, unknown>): ExpressionStore {
  return overrides as unknown as ExpressionStore;
}

describe("expression use cases", () => {
  it("returns the created expression id", async () => {
    const createPersonalExpressionStore = vi.fn(async () => ({ id: "expr-1" }));
    const store = storeStub({ createPersonalExpression: createPersonalExpressionStore });
    const input = { english: "Hello", koreanPrompt: "안녕", isMemorizationEnabled: true };

    await expect(createPersonalExpression(store, input)).resolves.toBe("expr-1");
    expect(createPersonalExpressionStore).toHaveBeenCalledWith(input);
  });

  it("deletes an expression and returns the topic redirect path", async () => {
    const deleteExpressionStore = vi.fn(async () => undefined);
    const store = storeStub({
      getExpression: vi.fn(async () => ({ id: "expr-1", expression_day_id: "day-fallback", day: { id: "day-1" } })),
      deletePersonalExpression: deleteExpressionStore
    });

    await expect(deletePersonalExpression(store, "expr-1")).resolves.toBe("/expressions?topic=day-1");
    expect(deleteExpressionStore).toHaveBeenCalledWith("expr-1");
  });

  it("rejects invalid review results before writing", async () => {
    const recordReviewResult = vi.fn(async () => ({ id: "expr-1" }));
    const store = storeStub({ recordReviewResult });

    await expect(recordExpressionReview(store, "expr-1", "maybe" as "known")).rejects.toThrow("암기 결과가 올바르지 않습니다.");
    expect(recordReviewResult).not.toHaveBeenCalled();
  });
});
