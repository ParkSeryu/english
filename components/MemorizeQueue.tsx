"use client";

import { useMemo, useState } from "react";

import { MemorizeCard } from "@/components/MemorizeCard";
import type { ExpressionCard } from "@/lib/types";

function deferHref(ids: string[]) {
  return ids.length > 0 ? `/memorize?defer=${encodeURIComponent(ids.join(","))}` : "/memorize";
}

function appendDeferredId(ids: string[], id: string) {
  return [...removeDeferredId(ids, id), id];
}

function removeDeferredId(ids: string[], id: string) {
  return ids.filter((deferredId) => deferredId !== id);
}

function normalizeDeferredIds(ids: string[], expressions: ExpressionCard[]) {
  const queueIds = new Set(expressions.map((expression) => expression.id));
  return [...new Set(ids)].filter((id) => queueIds.has(id));
}

function queueSignature(expressions: ExpressionCard[], deferredIds: string[]) {
  return `${expressions.map((expression) => expression.id).join("\u0000")}::${deferredIds.join("\u0000")}`;
}

function reviewReturnTargets(activeId: string, deferredIds: string[]) {
  const withoutActive = removeDeferredId(deferredIds, activeId);
  return {
    knownReturnTo: deferHref(withoutActive),
    unknownReturnTo: deferHref([...withoutActive, activeId])
  };
}

export function MemorizeQueue({ expressions, deferredIds = [] }: { expressions: ExpressionCard[]; deferredIds?: string[] }) {
  const initialDeferredIds = useMemo(() => normalizeDeferredIds(deferredIds, expressions), [deferredIds, expressions]);
  const propsSignature = useMemo(() => queueSignature(expressions, initialDeferredIds), [expressions, initialDeferredIds]);
  const [sessionState, setSessionState] = useState(() => ({
    signature: propsSignature,
    activeIndex: 0,
    deferredIds: initialDeferredIds
  }));
  const activeIndex = sessionState.signature === propsSignature ? sessionState.activeIndex : 0;
  const sessionDeferredIds = sessionState.signature === propsSignature ? sessionState.deferredIds : initialDeferredIds;
  const activeExpression = expressions[activeIndex] ?? expressions[0];

  if (!activeExpression) return null;

  const nextIndex = expressions.length > 1 ? (activeIndex + 1) % expressions.length : activeIndex;
  const { knownReturnTo, unknownReturnTo } = reviewReturnTargets(activeExpression.id, sessionDeferredIds);

  function handleReviewSubmit(result: "known" | "unknown") {
    setSessionState((current) => {
      const currentDeferredIds = current.signature === propsSignature ? current.deferredIds : initialDeferredIds;
      return {
        signature: propsSignature,
        activeIndex: nextIndex,
        deferredIds: result === "unknown" ? appendDeferredId(currentDeferredIds, activeExpression.id) : removeDeferredId(currentDeferredIds, activeExpression.id)
      };
    });
  }

  return (
    <MemorizeCard
      key={activeExpression.id}
      expression={activeExpression}
      knownReturnTo={knownReturnTo}
      unknownReturnTo={unknownReturnTo}
      onReviewSubmit={handleReviewSubmit}
    />
  );
}
