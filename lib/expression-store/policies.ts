import { scheduleMemorizationQueue } from "@/lib/scheduling";
import { expressionIngestionPayloadSchema } from "@/lib/validation";
import type {
  DashboardStats,
  ExpressionCard,
  ExpressionDay,
  ExpressionDaySummary,
  ExpressionIngestionPayload,
  ExpressionProgress,
  QuestionNote
} from "@/lib/types";

export type ExpressionStatsCard = Pick<ExpressionCard, "id" | "is_memorization_enabled" | "known_count" | "unknown_count" | "review_count" | "last_result" | "last_reviewed_at" | "due_at" | "interval_days" | "source_order" | "created_at">;
export type QuestionStats = Pick<QuestionNote, "status">;

export const PERSONAL_EXPRESSION_MARKER = "__personal_expression__";

export function nowIso() {
  return new Date().toISOString();
}

export function assertPayload(payload: ExpressionIngestionPayload) {
  return expressionIngestionPayloadSchema.parse(payload);
}

export function normalizeGrammarNote(note: string | null | undefined) {
  const value = String(note ?? "").trim();
  if (!value) return null;

  const lowerValue = value.toLowerCase();
  const routineExplanationPattern = /(현재시제|과거시제|미래시제|현재의\s*일반적인\s*사실|일반적인\s*사실|체질|문맥상|암기|원문\s*그대로|present tense|past tense|future tense|context)/i;
  if (routineExplanationPattern.test(lowerValue)) return null;

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  if (lines.some((line) => line.length > 80)) return null;

  const compactNote = lines.slice(0, 4).join("\n");
  if (compactNote.length > 240) return null;
  return compactNote;
}

export function defaultProgress(userId: string, expressionId: string, timestamp = nowIso()): ExpressionProgress {
  return {
    user_id: userId,
    expression_id: expressionId,
    user_memo: null,
    is_memorization_enabled: true,
    known_count: 0,
    unknown_count: 0,
    review_count: 0,
    last_result: null,
    last_reviewed_at: null,
    due_at: null,
    interval_days: 0,
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function applyProgress(card: ExpressionCard, progress?: Partial<ExpressionProgress> | null): ExpressionCard {
  return {
    ...card,
    can_delete: card.can_delete ?? false,
    user_memo: progress?.user_memo ?? null,
    is_memorization_enabled: progress?.is_memorization_enabled ?? true,
    known_count: progress?.known_count ?? 0,
    unknown_count: progress?.unknown_count ?? 0,
    review_count: progress?.review_count ?? 0,
    last_result: progress?.last_result ?? null,
    last_reviewed_at: progress?.last_reviewed_at ?? null,
    due_at: progress?.due_at ?? null,
    interval_days: progress?.interval_days ?? 0
  };
}

export function expressionStatsWithProgress(row: Pick<ExpressionCard, "id" | "known_count" | "unknown_count" | "review_count" | "last_result" | "last_reviewed_at" | "source_order" | "created_at">, progress?: Partial<ExpressionProgress> | null): ExpressionStatsCard {
  return {
    id: row.id,
    is_memorization_enabled: progress?.is_memorization_enabled ?? true,
    known_count: progress?.known_count ?? 0,
    unknown_count: progress?.unknown_count ?? 0,
    review_count: progress?.review_count ?? 0,
    last_result: progress?.last_result ?? null,
    last_reviewed_at: progress?.last_reviewed_at ?? null,
    due_at: progress?.due_at ?? null,
    interval_days: progress?.interval_days ?? 0,
    source_order: row.source_order,
    created_at: row.created_at
  };
}

export function expressionUrl(card: ExpressionCard) {
  return `/expressions/${card.id}`;
}

export function toDaySummary(day: ExpressionDay): ExpressionDaySummary {
  return { id: day.id, owner_id: day.owner_id, title: day.title, source_note: day.source_note, day_date: day.day_date, created_by: day.created_by };
}

export function calculateStats(dayCount: number, expressions: ExpressionStatsCard[], questions: QuestionStats[]): DashboardStats {
  const memorizationExpressions = expressions.filter((card) => card.is_memorization_enabled !== false);
  return {
    total: memorizationExpressions.length,
    knownReviews: memorizationExpressions.reduce((sum, card) => sum + card.known_count, 0),
    unknownReviews: memorizationExpressions.reduce((sum, card) => sum + card.unknown_count, 0),
    unseenCount: memorizationExpressions.filter((card) => !card.last_reviewed_at).length,
    dueCount: scheduleMemorizationQueue(expressions, 300).length,
    dayCount,
    questionCount: questions.length,
    openQuestionCount: questions.filter((note) => note.status === "open").length
  };
}
