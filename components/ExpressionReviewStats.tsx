import type { ExpressionCard } from "@/lib/types";

type ExpressionReviewStatsProps = {
  expression: Pick<ExpressionCard, "is_memorization_enabled" | "known_count" | "unknown_count">;
  variant?: "inline" | "stacked";
};

export function ExpressionReviewStats({ expression, variant = "inline" }: ExpressionReviewStatsProps) {
  if (!expression.is_memorization_enabled) return null;

  if (variant === "stacked") {
    return (
      <div className="shrink-0 space-y-0.5 text-xs font-semibold leading-4 text-slate-500">
        <div className="flex justify-end gap-1"><span>틀림</span><span className="tabular-nums">{expression.unknown_count}회</span></div>
        <div className="flex justify-end gap-1"><span>외움</span><span className="tabular-nums">{expression.known_count}회</span></div>
      </div>
    );
  }

  return <span>틀림 {expression.unknown_count}회 · 외움 {expression.known_count}회</span>;
}
