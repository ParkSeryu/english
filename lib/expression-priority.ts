import type { ExpressionCard } from "@/lib/types";

type ExpressionPriorityCandidate = Pick<ExpressionCard, "unknown_count" | "known_count" | "source_order"> & { can_delete?: boolean };

export function compareExpressionsForPriority<T extends ExpressionPriorityCandidate>(a: T, b: T) {
  const personalDelta = Number(Boolean(b.can_delete)) - Number(Boolean(a.can_delete));
  if (personalDelta !== 0) return personalDelta;

  const unknownDelta = b.unknown_count - a.unknown_count;
  if (unknownDelta !== 0) return unknownDelta;

  const knownDelta = a.known_count - b.known_count;
  if (knownDelta !== 0) return knownDelta;

  return a.source_order - b.source_order;
}

export function sortExpressionsByPriority<T extends ExpressionPriorityCandidate>(expressions: T[]) {
  return [...expressions].sort(compareExpressionsForPriority);
}
