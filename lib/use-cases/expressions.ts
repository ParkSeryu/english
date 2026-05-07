import type { ExpressionStore } from "@/lib/lesson-store";
import type { CardMemoInput, PersonalExpressionInput, PersonalExpressionUpdateInput } from "@/lib/types";

export type ExpressionReviewResult = "known" | "unknown";

export async function updateExpressionMemo(store: ExpressionStore, expressionId: string, input: CardMemoInput) {
  await store.updateExpressionMemo(expressionId, input);
}

export async function createPersonalExpression(store: ExpressionStore, input: PersonalExpressionInput) {
  const expression = await store.createPersonalExpression(input);
  return expression.id;
}

export async function updatePersonalExpression(store: ExpressionStore, expressionId: string, input: PersonalExpressionUpdateInput) {
  await store.updatePersonalExpression(expressionId, input);
}

export async function deletePersonalExpression(store: ExpressionStore, expressionId: string) {
  const expression = await store.getExpression(expressionId);
  const targetDayId = expression?.day?.id ?? expression?.expression_day_id ?? null;
  await store.deletePersonalExpression(expressionId);
  return targetDayId ? `/expressions?topic=${targetDayId}` : "/expressions";
}

export async function recordExpressionReview(store: ExpressionStore, expressionId: string, result: ExpressionReviewResult) {
  if (result !== "known" && result !== "unknown") throw new Error("암기 결과가 올바르지 않습니다.");
  await store.recordReviewResult(expressionId, result);
}
