import type { ExpressionCard } from "@/lib/types";

type DueLabelExpression = Pick<ExpressionCard, "is_memorization_enabled" | "due_at">;

const KOREA_TIME_ZONE = "Asia/Seoul";
const koreanDueDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KOREA_TIME_ZONE,
  month: "long",
  day: "numeric",
  weekday: "short"
});

export function getExpressionDueLabel(expression: DueLabelExpression, now = new Date()) {
  if (expression.is_memorization_enabled === false) return null;

  if (!expression.due_at) return "암기 카드 · 오늘 복습";

  const dueAt = Date.parse(expression.due_at);
  if (!Number.isFinite(dueAt) || dueAt <= now.getTime()) return "암기 카드 · 오늘 복습";

  return `암기 카드 · 다음 복습 ${koreanDueDateFormatter.format(new Date(dueAt))}`;
}
