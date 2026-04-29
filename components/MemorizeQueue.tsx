"use client";

import { useEffect, useMemo, useState } from "react";

import { MemorizeCard } from "@/components/MemorizeCard";
import type { ExpressionCard } from "@/lib/types";

const DEFAULT_STORAGE_KEY = "english:memorize-session:v1";
const EMPTY_DEFERRED_IDS: string[] = [];

type QueueState = {
  signature: string;
  queueIds: string[];
  activeId: string | null;
  deferredIds: string[];
};

type StoredQueueState = {
  queueIds?: unknown;
  activeId?: unknown;
  deferredIds?: unknown;
};

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

function orderedExpressions(expressions: ExpressionCard[], queueIds: string[]) {
  if (queueIds.length === 0) return [];
  const byId = new Map(expressions.map((expression) => [expression.id, expression]));
  const ordered = queueIds.flatMap((id) => {
    const expression = byId.get(id);
    return expression ? [expression] : [];
  });
  const orderedIds = new Set(ordered.map((expression) => expression.id));
  return [...ordered, ...expressions.filter((expression) => !orderedIds.has(expression.id))];
}

function defaultQueueState(signature: string, expressions: ExpressionCard[], deferredIds: string[]): QueueState {
  const queueIds = expressions.map((expression) => expression.id);
  return {
    signature,
    queueIds,
    activeId: queueIds[0] ?? null,
    deferredIds: normalizeDeferredIds(deferredIds, expressions)
  };
}

function unknownArrayToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function readStoredQueueState(storageKey: string): StoredQueueState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredQueueState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

function writeStoredQueueState(storageKey: string, state: QueueState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      queueIds: state.queueIds,
      activeId: state.activeId,
      deferredIds: state.deferredIds,
      savedAt: new Date().toISOString()
    })
  );
}

function reconcileQueueState(signature: string, expressions: ExpressionCard[], deferredIds: string[], stored: StoredQueueState | null): QueueState {
  const fallback = defaultQueueState(signature, expressions, deferredIds);
  if (!stored) return fallback;

  const validIds = new Set(fallback.queueIds);
  const storedQueueIds = unknownArrayToStrings(stored.queueIds).filter((id) => validIds.has(id));
  const storedQueueIdSet = new Set(storedQueueIds);
  const queueIds = [...storedQueueIds, ...fallback.queueIds.filter((id) => !storedQueueIdSet.has(id))];
  const activeId = typeof stored.activeId === "string" && queueIds.includes(stored.activeId) ? stored.activeId : (queueIds[0] ?? null);
  const storedDeferredIds = unknownArrayToStrings(stored.deferredIds);
  const normalizedDeferredIds = normalizeDeferredIds([...fallback.deferredIds, ...storedDeferredIds], expressions);

  return {
    signature,
    queueIds,
    activeId,
    deferredIds: normalizedDeferredIds
  };
}

function advanceQueue(queueIds: string[], activeId: string, result: "known" | "unknown") {
  const activeIndex = Math.max(queueIds.indexOf(activeId), 0);
  const withoutActive = queueIds.filter((id) => id !== activeId);

  if (result === "unknown") {
    const nextQueueIds = [...withoutActive, activeId];
    return {
      queueIds: nextQueueIds,
      activeId: withoutActive[activeIndex] ?? withoutActive[0] ?? activeId
    };
  }

  return {
    queueIds: withoutActive,
    activeId: withoutActive[activeIndex] ?? withoutActive[0] ?? null
  };
}

export function MemorizeQueue({ expressions, deferredIds, storageKey = DEFAULT_STORAGE_KEY }: { expressions: ExpressionCard[]; deferredIds?: string[]; storageKey?: string }) {
  const deferredIdInput = deferredIds ?? EMPTY_DEFERRED_IDS;
  const initialDeferredIds = useMemo(() => normalizeDeferredIds(deferredIdInput, expressions), [deferredIdInput, expressions]);
  const propsSignature = useMemo(() => queueSignature(expressions, initialDeferredIds), [expressions, initialDeferredIds]);
  const fallbackState = useMemo(() => defaultQueueState(propsSignature, expressions, initialDeferredIds), [propsSignature, expressions, initialDeferredIds]);
  const [sessionState, setSessionState] = useState<QueueState>(fallbackState);
  const [storageReady, setStorageReady] = useState(false);
  const activeState = sessionState.signature === propsSignature ? sessionState : fallbackState;
  const queue = orderedExpressions(expressions, activeState.queueIds);
  const remainingCount = activeState.queueIds.length;
  const activeExpression = queue.find((expression) => expression.id === activeState.activeId) ?? queue[0];

  useEffect(() => {
    setSessionState(reconcileQueueState(propsSignature, expressions, initialDeferredIds, readStoredQueueState(storageKey)));
    setStorageReady(true);
  }, [expressions, initialDeferredIds, propsSignature, storageKey]);

  useEffect(() => {
    if (!storageReady || sessionState.signature !== propsSignature) return;
    writeStoredQueueState(storageKey, sessionState);
  }, [propsSignature, sessionState, storageKey, storageReady]);

  if (!storageReady) {
    return (
      <div className="space-y-5">
        <MemorizeQueueHeader remainingCount={remainingCount} />
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-500 shadow-card" aria-live="polite">
          복습 준비 중…
        </section>
      </div>
    );
  }

  if (!activeExpression) {
    return (
      <div className="space-y-5">
        <MemorizeQueueHeader remainingCount={remainingCount} />
      </div>
    );
  }

  const { knownReturnTo, unknownReturnTo } = reviewReturnTargets(activeExpression.id, activeState.deferredIds);

  function handleReviewSubmit(result: "known" | "unknown") {
    setSessionState((current) => {
      const currentState = current.signature === propsSignature ? current : fallbackState;
      const nextQueue = advanceQueue(currentState.queueIds, activeExpression.id, result);
      return {
        signature: propsSignature,
        queueIds: nextQueue.queueIds,
        activeId: nextQueue.activeId,
        deferredIds: result === "unknown" ? appendDeferredId(currentState.deferredIds, activeExpression.id) : removeDeferredId(currentState.deferredIds, activeExpression.id)
      };
    });
  }

  return (
    <div className="space-y-5">
      <MemorizeQueueHeader remainingCount={remainingCount} />
      <MemorizeCard
        key={activeExpression.id}
        expression={activeExpression}
        knownReturnTo={knownReturnTo}
        unknownReturnTo={unknownReturnTo}
        onReviewSubmit={handleReviewSubmit}
      />
    </div>
  );
}

function MemorizeQueueHeader({ remainingCount }: { remainingCount: number }) {
  return (
    <header>
      <h1 className="text-3xl font-black leading-tight tracking-[-0.03em] text-ink">오늘의 복습</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">복습할 표현 {remainingCount}개</p>
    </header>
  );
}
