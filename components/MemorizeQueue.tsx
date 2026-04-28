"use client";

import { useState } from "react";

import { MemorizeCard } from "@/components/MemorizeCard";
import type { ExpressionCard } from "@/lib/types";

export function MemorizeQueue({ expressions }: { expressions: ExpressionCard[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeExpression = expressions[activeIndex] ?? expressions[0];

  if (!activeExpression) return null;

  const nextIndex = expressions.length > 1 ? (activeIndex + 1) % expressions.length : activeIndex;
  const returnTo = expressions.length > 1 ? `/memorize?skip=${encodeURIComponent(activeExpression.id)}` : "/memorize";

  return (
    <MemorizeCard
      key={activeExpression.id}
      expression={activeExpression}
      returnTo={returnTo}
      onReviewSubmit={() => setActiveIndex(nextIndex)}
    />
  );
}
