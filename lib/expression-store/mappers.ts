import type {
  ContentFolderSummary,
  ExpressionCard,
  ExpressionDay,
  ExpressionDaySummary,
  ExpressionExample,
  ExpressionIngestionPayload,
  IngestionRun
} from "@/lib/types";
import { assertPayload } from "@/lib/expression-store/policies";

export type SupabaseContentFolderSummary = Pick<ContentFolderSummary, "id" | "name" | "slug" | "parent_id"> & {
  path_names: string[] | null;
};

export type SupabaseExpressionDaySummary = Omit<ExpressionDaySummary, "folder_id" | "folder" | "folder_path"> & {
  folder_id: string | null;
  content_folders?: SupabaseContentFolderSummary | SupabaseContentFolderSummary[] | null;
};

export type SupabaseExpressionRow = Omit<ExpressionCard, "due_at" | "interval_days" | "examples" | "day"> & {
  due_at?: string | null;
  interval_days?: number;
  expression_examples?: ExpressionExample[] | null;
  expression_days?: SupabaseExpressionDaySummary | SupabaseExpressionDaySummary[] | null;
};

export type SupabaseExpressionDayRow = Omit<ExpressionDay, "expressions" | "folder" | "folder_path"> & {
  folder_id: string | null;
  content_folders?: SupabaseContentFolderSummary | SupabaseContentFolderSummary[] | null;
  expressions?: SupabaseExpressionRow[] | null;
};

export type SupabaseIngestionRunRow = Omit<IngestionRun, "normalized_payload"> & { normalized_payload: unknown };
export type SupabaseExpressionStatsRow = Pick<ExpressionCard, "id" | "known_count" | "unknown_count" | "review_count" | "last_result" | "last_reviewed_at" | "source_order" | "created_at">;

export const EXPRESSION_CARD_COLUMNS = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at";
export const EXPRESSION_STATS_COLUMNS = "id, known_count, unknown_count, review_count, last_result, last_reviewed_at, source_order, created_at";
export const EXPRESSION_DAY_COLUMNS = "id,owner_id,title,raw_input,source_note,day_date,folder_id,created_by,created_at,updated_at";
export const LEGACY_EXPRESSION_DAY_COLUMNS = "id,owner_id,title,raw_input,source_note,day_date,created_by,created_at,updated_at";
export const EXPRESSION_DAY_WITH_CARDS_SELECT = `${EXPRESSION_DAY_COLUMNS},expressions(id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at))`;
export const LEGACY_EXPRESSION_DAY_WITH_CARDS_SELECT = `${LEGACY_EXPRESSION_DAY_COLUMNS},expressions(id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at))`;
export const EXPRESSION_WITH_DAY_SELECT = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at), expression_days(id,owner_id,title,source_note,day_date,created_by,folder_id)";
export const LEGACY_EXPRESSION_WITH_DAY_SELECT = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at), expression_days(id,owner_id,title,source_note,day_date,created_by)";
export function normalizeFolder(summary: unknown): ContentFolderSummary | null {
  if (!summary || typeof summary !== "object") return null;
  if (Array.isArray(summary)) return normalizeFolder(summary[0]);

  const candidate = summary as Partial<SupabaseContentFolderSummary>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  const pathNames = Array.isArray(candidate.path_names)
    ? candidate.path_names.filter((name): name is string => typeof name === "string")
    : [];

  return {
    id: candidate.id,
    name: String(candidate.name ?? ""),
    slug: String(candidate.slug ?? ""),
    parent_id: typeof candidate.parent_id === "string" ? candidate.parent_id : null,
    path_names: pathNames
  };
}

export function normalizeExpression(row: SupabaseExpressionRow): ExpressionCard {
  const { expression_examples: examples, due_at, interval_days, expression_days, ...expression } = row;
  const relationBase = Array.isArray(expression_days) ? expression_days[0] : expression_days;
  const relation = relationBase ?? null;
  const normalizedFolder = normalizeFolder(relation?.content_folders);
  const dayFolder = relation
    ? {
        id: relation.id,
        owner_id: relation.owner_id,
        title: relation.title,
        source_note: relation.source_note,
        day_date: relation.day_date,
        created_by: relation.created_by,
        folder_id: relation.folder_id ?? null,
        folder: normalizedFolder,
        folder_path: normalizedFolder?.path_names ?? []
      }
    : undefined;

  return {
    ...expression,
    due_at: due_at ?? null,
    interval_days: interval_days ?? 0,
    day: dayFolder,
    examples: [...(examples ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  };
}

export function normalizeExpressionDay(row: SupabaseExpressionDayRow): ExpressionDay {
  const { expressions, ...day } = row;
  const normalizedFolder = normalizeFolder(day.content_folders);
  return {
    ...day,
    folder: normalizedFolder,
    folder_path: normalizedFolder?.path_names ?? [],
    expressions: [...(expressions ?? [])].map(normalizeExpression).sort((a, b) => a.source_order - b.source_order)
  };
}

export function normalizeIngestionRun(row: SupabaseIngestionRunRow): IngestionRun {
  return { ...row, normalized_payload: assertPayload(row.normalized_payload as ExpressionIngestionPayload) };
}
