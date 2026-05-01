import { randomUUID } from "node:crypto";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { nextExpressionReviewSchedule, scheduleMemorizationQueue } from "@/lib/scheduling";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isE2EMemoryMode } from "@/lib/test-mode";
import { expressionIngestionPayloadSchema } from "@/lib/validation";
import type {
  ApprovedExpressionDayResult,
  CardMemoInput,
  DashboardStats,
  ExpressionCard,
  ExpressionDay,
  ExpressionDaySummary,
  ContentFolderSummary,
  ExpressionExample,
  ExpressionIngestionPayload,
  ExpressionProgress,
  IngestionRun,
  QuestionNote,
  QuestionNoteInput,
  QuestionNoteStatus,
  UserIdentity
} from "@/lib/types";

type SupabaseLike = Awaited<ReturnType<typeof createServerSupabaseClient>> | ReturnType<typeof createServiceRoleSupabaseClient>;

type SupabaseContentFolderSummary = Pick<ContentFolderSummary, "id" | "name" | "slug" | "parent_id"> & {
  path_names: string[] | null;
};

type SupabaseExpressionDaySummary = Omit<ExpressionDaySummary, "folder_id" | "folder" | "folder_path"> & {
  folder_id: string | null;
  content_folders?: SupabaseContentFolderSummary | SupabaseContentFolderSummary[] | null;
};

type SupabaseExpressionRow = Omit<ExpressionCard, "due_at" | "interval_days" | "examples" | "day"> & {
  due_at?: string | null;
  interval_days?: number;
  expression_examples?: ExpressionExample[] | null;
  expression_days?: SupabaseExpressionDaySummary | SupabaseExpressionDaySummary[] | null;
};

type SupabaseExpressionDayRow = Omit<ExpressionDay, "expressions" | "folder" | "folder_path"> & {
  folder_id: string | null;
  content_folders?: SupabaseContentFolderSummary | SupabaseContentFolderSummary[] | null;
  expressions?: SupabaseExpressionRow[] | null;
};

type SupabaseIngestionRunRow = Omit<IngestionRun, "normalized_payload"> & { normalized_payload: unknown };
type ExpressionStatsCard = Pick<ExpressionCard, "id" | "known_count" | "unknown_count" | "review_count" | "last_result" | "last_reviewed_at" | "due_at" | "interval_days" | "source_order" | "created_at">;
type SupabaseExpressionStatsRow = Pick<ExpressionCard, "id" | "known_count" | "unknown_count" | "review_count" | "last_result" | "last_reviewed_at" | "source_order" | "created_at">;
type QuestionStats = Pick<QuestionNote, "status">;

const EXPRESSION_CARD_COLUMNS = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at";
const EXPRESSION_STATS_COLUMNS = "id, known_count, unknown_count, review_count, last_result, last_reviewed_at, source_order, created_at";
const EXPRESSION_DAY_COLUMNS = "id,owner_id,title,raw_input,source_note,day_date,folder_id,created_by,created_at,updated_at";
const LEGACY_EXPRESSION_DAY_COLUMNS = "id,owner_id,title,raw_input,source_note,day_date,created_by,created_at,updated_at";
const EXPRESSION_DAY_WITH_CARDS_SELECT = `${EXPRESSION_DAY_COLUMNS},expressions(id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at))`;
const LEGACY_EXPRESSION_DAY_WITH_CARDS_SELECT = `${LEGACY_EXPRESSION_DAY_COLUMNS},expressions(id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at))`;
const EXPRESSION_WITH_DAY_SELECT = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at), expression_days(id,title,source_note,day_date,folder_id)";
const LEGACY_EXPRESSION_WITH_DAY_SELECT = "id, expression_day_id, owner_id, english, korean_prompt, nuance_note, structure_note, grammar_note, user_memo, source_order, known_count, unknown_count, review_count, last_result, last_reviewed_at, created_at, updated_at, expression_examples(id, expression_id, example_text, meaning_ko, source, sort_order, created_at), expression_days(id,title,source_note,day_date)";

export interface ExpressionStore {
  listExpressionDays(): Promise<ExpressionDay[]>;
  getExpressionDay(id: string): Promise<ExpressionDay | null>;
  getExpression(id: string): Promise<ExpressionCard | null>;
  getMemorizationQueue(options?: { limit?: number }): Promise<ExpressionCard[]>;
  getDashboardStats(): Promise<DashboardStats>;
  getDashboardOverview(options?: { queueLimit?: number; recentDayLimit?: number }): Promise<{
    stats: DashboardStats;
    recentDays: ExpressionDay[];
    queue: ExpressionCard[];
  }>;
  recordReviewResult(id: string, result: "known" | "unknown"): Promise<ExpressionCard>;
  updateExpressionMemo(id: string, input: CardMemoInput): Promise<ExpressionCard>;
  listQuestionNotes(): Promise<QuestionNote[]>;
  createQuestionNote(input: QuestionNoteInput): Promise<QuestionNote>;
  updateQuestionNote(id: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }): Promise<QuestionNote>;
  createDraft(payload: ExpressionIngestionPayload): Promise<IngestionRun>;
  reviseDraft(id: string, payload: ExpressionIngestionPayload): Promise<IngestionRun>;
  approveDraft(id: string, approvalText: string): Promise<ApprovedExpressionDayResult>;
  getIngestionRun(id: string): Promise<IngestionRun | null>;
}

function nowIso() {
  return new Date().toISOString();
}

function assertPayload(payload: ExpressionIngestionPayload) {
  return expressionIngestionPayloadSchema.parse(payload);
}

function normalizeGrammarNote(note: string | null | undefined) {
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

function isFolderSchemaUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    ["42703", "42P01", "42883", "PGRST200", "PGRST204", "PGRST202"].includes(code)
    || text.includes("folder_id")
    || text.includes("content_folders")
    || text.includes("can_read_content_folder")
    || text.includes("schema cache")
  );
}

function logFolderSchemaFallback(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  console.warn(`[topic-folder-access] ${scope}: folder schema unavailable, falling back to legacy read`, message);
}

function normalizeFolder(summary: unknown): ContentFolderSummary | null {
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

function normalizeExpression(row: SupabaseExpressionRow): ExpressionCard {
  const { expression_examples: examples, due_at, interval_days, expression_days, ...expression } = row;
  const relationBase = Array.isArray(expression_days) ? expression_days[0] : expression_days;
  const relation = relationBase ?? null;
  const normalizedFolder = normalizeFolder(relation?.content_folders);
  const dayFolder = relation
    ? {
        id: relation.id,
        title: relation.title,
        source_note: relation.source_note,
        day_date: relation.day_date,
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

function normalizeExpressionDay(row: SupabaseExpressionDayRow): ExpressionDay {
  const { expressions, ...day } = row;
  const normalizedFolder = normalizeFolder(day.content_folders);
  return {
    ...day,
    folder: normalizedFolder,
    folder_path: normalizedFolder?.path_names ?? [],
    expressions: [...(expressions ?? [])].map(normalizeExpression).sort((a, b) => a.source_order - b.source_order)
  };
}

async function resolveDefaultWritableFolder(supabase: SupabaseLike) {
  const { data, error } = await supabase
    .from("content_folders")
    .select("id")
    .eq("slug", "legacy-root")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) raiseStoreError("supabase query", error);
  if (!data?.id) throw new Error("기본 표현 폴더를 찾을 수 없습니다.");
  return data.id as string;
}

function normalizeIngestionRun(row: SupabaseIngestionRunRow): IngestionRun {
  return { ...row, normalized_payload: assertPayload(row.normalized_payload as ExpressionIngestionPayload) };
}

function raiseStoreError(operation: string, error: unknown): never {
  console.error(`[ExpressionStore] ${operation} failed`, error);
  throw error;
}

function requireEntity<T>(entity: T | null | undefined, message: string): T {
  if (!entity) throw new Error(message);
  return entity;
}

function defaultProgress(userId: string, expressionId: string, timestamp = nowIso()): ExpressionProgress {
  return {
    user_id: userId,
    expression_id: expressionId,
    user_memo: null,
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

function applyProgress(card: ExpressionCard, progress?: Partial<ExpressionProgress> | null): ExpressionCard {
  return {
    ...card,
    user_memo: progress?.user_memo ?? null,
    known_count: progress?.known_count ?? 0,
    unknown_count: progress?.unknown_count ?? 0,
    review_count: progress?.review_count ?? 0,
    last_result: progress?.last_result ?? null,
    last_reviewed_at: progress?.last_reviewed_at ?? null,
    due_at: progress?.due_at ?? null,
    interval_days: progress?.interval_days ?? 0
  };
}

function expressionStatsWithProgress(row: SupabaseExpressionStatsRow, progress?: Partial<ExpressionProgress> | null): ExpressionStatsCard {
  return {
    id: row.id,
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

function expressionUrl(card: ExpressionCard) {
  return `/expressions/${card.id}`;
}

class SupabaseExpressionStore implements ExpressionStore {
  constructor(
    private readonly user: UserIdentity,
    private readonly createClient: () => Promise<SupabaseLike> | SupabaseLike = createServerSupabaseClient
  ) {}

  private async supabase() {
    return this.createClient();
  }

  private async contentSupabase() {
    // Expression content is shared across signed-in users, but learner-facing
    // reads should use the current user's Supabase session. Depending on a
    // service-role key here can surface a raw Supabase "Unauthorized" response
    // if production deployment env is missing or stale.
    return this.supabase();
  }

  private async foldersForIds(folderIds: Array<string | null | undefined>) {
    const uniqueFolderIds = [...new Set(folderIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (uniqueFolderIds.length === 0) return new Map<string, ContentFolderSummary>();

    const { data, error } = await (await this.contentSupabase())
      .from("content_folders")
      .select("id,name,slug,parent_id,path_names")
      .in("id", uniqueFolderIds);
    if (error) {
      if (isFolderSchemaUnavailableError(error)) {
        logFolderSchemaFallback("foldersForIds", error);
        return new Map<string, ContentFolderSummary>();
      }
      raiseStoreError("supabase query", error);
    }

    return new Map((data ?? []).map((row) => {
      const folder = normalizeFolder(row);
      return folder ? [folder.id, folder] : null;
    }).filter((entry): entry is [string, ContentFolderSummary] => entry !== null));
  }

  private async hydrateExpressionDays(days: ExpressionDay[]) {
    const folders = await this.foldersForIds(days.map((day) => day.folder_id));
    return days.map((day) => {
      const folder = day.folder_id ? folders.get(day.folder_id) ?? null : null;
      return {
        ...day,
        folder,
        folder_path: folder?.path_names ?? [],
        expressions: day.expressions.map((card) => ({
          ...card,
          day: card.day
            ? {
                ...card.day,
                folder_id: day.folder_id ?? null,
                folder,
                folder_path: folder?.path_names ?? []
              }
            : card.day
        }))
      };
    });
  }

  private async hydrateExpressionCards(cards: ExpressionCard[]) {
    const folders = await this.foldersForIds(cards.map((card) => card.day?.folder_id));
    return cards.map((card) => {
      if (!card.day) return card;
      const folder = card.day.folder_id ? folders.get(card.day.folder_id) ?? null : null;
      return {
        ...card,
        day: {
          ...card.day,
          folder,
          folder_path: folder?.path_names ?? []
        }
      };
    });
  }

  private async progressFor(expressionIds: string[]) {
    if (expressionIds.length === 0) return new Map<string, ExpressionProgress>();
    const { data, error } = await (await this.supabase())
      .from("expression_progress")
      .select("*")
      .eq("user_id", this.user.id)
      .in("expression_id", expressionIds);
    if (error) raiseStoreError("supabase query", error);
    return new Map((data ?? []).map((row: ExpressionProgress) => [row.expression_id, row]));
  }

  private async progressForOne(expressionId: string) {
    const { data, error } = await (await this.supabase())
      .from("expression_progress")
      .select("*")
      .eq("user_id", this.user.id)
      .eq("expression_id", expressionId)
      .maybeSingle();
    if (error) raiseStoreError("supabase query", error);
    return (data as ExpressionProgress | null) ?? null;
  }

  private async applyUserProgress(cards: ExpressionCard[]) {
    const progress = await this.progressFor(cards.map((card) => card.id));
    return cards.map((card) => applyProgress(card, progress.get(card.id)));
  }

  async listExpressionDays() {
    const supabase = await this.contentSupabase();
    let { data, error } = await supabase
      .from("expression_days")
      .select(EXPRESSION_DAY_WITH_CARDS_SELECT)
      .order("day_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("listExpressionDays", error);
      const legacyResult = await supabase
        .from("expression_days")
        .select(LEGACY_EXPRESSION_DAY_WITH_CARDS_SELECT)
        .order("day_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) raiseStoreError("supabase query", error);
    const days = await this.hydrateExpressionDays((data ?? []).map((row: SupabaseExpressionDayRow) => normalizeExpressionDay(row)));
    const progress = await this.progressFor(days.flatMap((day) => day.expressions.map((card) => card.id)));
    return days.map((day) => ({ ...day, expressions: day.expressions.map((card) => applyProgress(card, progress.get(card.id))) }));
  }

  async getExpressionDay(id: string) {
    const supabase = await this.contentSupabase();
    let { data, error } = await supabase
      .from("expression_days")
      .select(EXPRESSION_DAY_WITH_CARDS_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("getExpressionDay", error);
      const legacyResult = await supabase
        .from("expression_days")
        .select(LEGACY_EXPRESSION_DAY_WITH_CARDS_SELECT)
        .eq("id", id)
        .maybeSingle();
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) raiseStoreError("supabase query", error);
    if (!data) return null;
    const [day] = await this.hydrateExpressionDays([normalizeExpressionDay(data as SupabaseExpressionDayRow)]);
    const progress = await this.progressFor(day.expressions.map((card) => card.id));
    return { ...day, expressions: day.expressions.map((card) => applyProgress(card, progress.get(card.id))) };
  }

  async getExpression(id: string) {
    const supabase = await this.contentSupabase();
    let { data, error } = await supabase
      .from("expressions")
      .select(EXPRESSION_WITH_DAY_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("getExpression", error);
      const legacyResult = await supabase
        .from("expressions")
        .select(LEGACY_EXPRESSION_WITH_DAY_SELECT)
        .eq("id", id)
        .maybeSingle();
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) raiseStoreError("supabase query", error);
    if (!data) return null;
    const [card] = await this.hydrateExpressionCards([normalizeExpression(data as SupabaseExpressionRow)]);
    return applyProgress(card, await this.progressForOne(card.id));
  }

  private async listExpressions() {
    const supabase = await this.contentSupabase();
    let { data, error } = await supabase
      .from("expressions")
      .select(EXPRESSION_WITH_DAY_SELECT)
      .order("source_order", { ascending: true });
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("listExpressions", error);
      const legacyResult = await supabase
        .from("expressions")
        .select(LEGACY_EXPRESSION_WITH_DAY_SELECT)
        .order("source_order", { ascending: true });
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) raiseStoreError("supabase query", error);
    return this.applyUserProgress(await this.hydrateExpressionCards((data ?? []).map((row: SupabaseExpressionRow) => normalizeExpression(row))));
  }

  private async listExpressionStats() {
    const supabase = await this.contentSupabase();
    const { data, error } = await supabase.from("expressions").select(EXPRESSION_STATS_COLUMNS).order("source_order", { ascending: true });
    if (error) raiseStoreError("supabase query", error);

    const rows = (data ?? []) as SupabaseExpressionStatsRow[];
    const progress = await this.progressFor(rows.map((row) => row.id));
    return rows.map((row) => expressionStatsWithProgress(row, progress.get(row.id)));
  }

  private async countExpressionDays() {
    const { count, error } = await (await this.contentSupabase()).from("expression_days").select("id", { count: "exact", head: true });
    if (error) raiseStoreError("supabase query", error);
    return count ?? 0;
  }

  private async listRecentExpressionDays(limit: number) {
    if (limit <= 0) return [];
    const supabase = await this.contentSupabase();
    let { data, error } = await supabase
      .from("expression_days")
      .select(`${EXPRESSION_DAY_COLUMNS},expressions(${EXPRESSION_CARD_COLUMNS})`)
      .order("day_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("listRecentExpressionDays", error);
      const legacyResult = await supabase
        .from("expression_days")
        .select(`${LEGACY_EXPRESSION_DAY_COLUMNS},expressions(${EXPRESSION_CARD_COLUMNS})`)
        .order("day_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) raiseStoreError("supabase query", error);
    const days = await this.hydrateExpressionDays((data ?? []).map((row: SupabaseExpressionDayRow) => normalizeExpressionDay(row)));
    return days.map((day) => {
      return { ...day, expressions: day.expressions.map((card) => applyProgress(card, null)) };
    });
  }

  private async listQuestionStats() {
    const { data, error } = await (await this.supabase()).from("question_notes").select("status").eq("owner_id", this.user.id);
    if (error) raiseStoreError("supabase query", error);
    return (data ?? []) as QuestionStats[];
  }

  async getMemorizationQueue(options: { limit?: number } = {}) {
    return scheduleMemorizationQueue(await this.listExpressions(), options.limit ?? 300);
  }

  async getDashboardStats() {
    const [dayCount, expressions, questions] = await Promise.all([this.countExpressionDays(), this.listExpressionStats(), this.listQuestionStats()]);
    return calculateStats(dayCount, expressions, questions);
  }

  async getDashboardOverview(options: { queueLimit?: number; recentDayLimit?: number } = {}) {
    const queueLimit = options.queueLimit ?? 3;
    const [dayCount, recentDays, expressions, questions, queueExpressions] = await Promise.all([
      this.countExpressionDays(),
      this.listRecentExpressionDays(options.recentDayLimit ?? 3),
      this.listExpressionStats(),
      this.listQuestionStats(),
      queueLimit > 0 ? this.listExpressions() : Promise.resolve([])
    ]);
    return {
      stats: calculateStats(dayCount, expressions, questions),
      recentDays,
      queue: queueLimit > 0 ? scheduleMemorizationQueue(queueExpressions, queueLimit) : []
    };
  }

  async recordReviewResult(id: string, result: "known" | "unknown") {
    const existing = requireEntity(await this.getExpression(id), "Expression not found");
    const current = (await this.progressForOne(id)) ?? defaultProgress(this.user.id, id, existing.created_at);
    const timestamp = nowIso();
    const schedule = nextExpressionReviewSchedule(current, result, new Date(timestamp));
    const { error } = await (await this.supabase())
      .from("expression_progress")
      .upsert(
        {
          user_id: this.user.id,
          expression_id: id,
          user_memo: current.user_memo ?? null,
          known_count: result === "known" ? current.known_count + 1 : current.known_count,
          unknown_count: result === "unknown" ? current.unknown_count + 1 : current.unknown_count,
          review_count: current.review_count + 1,
          last_result: result,
          last_reviewed_at: timestamp,
          interval_days: schedule.intervalDays,
          due_at: schedule.dueAt,
          updated_at: timestamp
        },
        { onConflict: "user_id,expression_id" }
      );
    if (error) raiseStoreError("supabase query", error);
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async updateExpressionMemo(id: string, input: CardMemoInput) {
    const existing = requireEntity(await this.getExpression(id), "Expression not found");
    const current = (await this.progressForOne(id)) ?? defaultProgress(this.user.id, id, existing.created_at);
    const timestamp = nowIso();
    const { error } = await (await this.supabase())
      .from("expression_progress")
      .upsert(
        {
          user_id: this.user.id,
          expression_id: id,
          user_memo: input.userMemo || null,
          known_count: current.known_count,
          unknown_count: current.unknown_count,
          review_count: current.review_count,
          last_result: current.last_result,
          last_reviewed_at: current.last_reviewed_at,
          due_at: current.due_at,
          interval_days: current.interval_days,
          updated_at: timestamp
        },
        { onConflict: "user_id,expression_id" }
      );
    if (error) raiseStoreError("supabase query", error);
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async listQuestionNotes() {
    const { data, error } = await (await this.supabase())
      .from("question_notes")
      .select("*")
      .eq("owner_id", this.user.id)
      .order("status", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) raiseStoreError("supabase query", error);
    return (data ?? []) as QuestionNote[];
  }

  async createQuestionNote(input: QuestionNoteInput) {
    const timestamp = nowIso();
    const status = input.status ?? (input.answerNote ? "answered" : "open");
    const { data, error } = await (await this.supabase())
      .from("question_notes")
      .insert({ owner_id: this.user.id, question_text: input.questionText, answer_note: input.answerNote || null, status, updated_at: timestamp })
      .select("*")
      .single();
    if (error) raiseStoreError("supabase query", error);
    return data as QuestionNote;
  }

  async updateQuestionNote(id: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }) {
    const patch: Record<string, string | null> = { updated_at: nowIso() };
    if (input.questionText !== undefined) patch.question_text = input.questionText;
    if (input.answerNote !== undefined) patch.answer_note = input.answerNote || null;
    if (input.status !== undefined) patch.status = input.status;
    const { data, error } = await (await this.supabase()).from("question_notes").update(patch).eq("id", id).eq("owner_id", this.user.id).select("*").single();
    if (error) raiseStoreError("supabase query", error);
    return data as QuestionNote;
  }

  async createDraft(payload: ExpressionIngestionPayload) {
    const normalized = assertPayload(payload);
    const timestamp = nowIso();
    const { data, error } = await (await this.supabase())
      .from("ingestion_runs")
      .insert({ owner_id: this.user.id, raw_input: normalized.expression_day.raw_input, normalized_payload: normalized, status: "drafted", updated_at: timestamp })
      .select("*")
      .single();
    if (error) raiseStoreError("supabase query", error);
    return normalizeIngestionRun(data as SupabaseIngestionRunRow);
  }

  async reviseDraft(id: string, payload: ExpressionIngestionPayload) {
    const existing = requireEntity(await this.getIngestionRun(id), "Ingestion draft not found");
    if (existing.status === "inserted") throw new Error("이미 저장된 드래프트는 수정할 수 없습니다.");
    const normalized = assertPayload(payload);
    const { data, error } = await (await this.supabase())
      .from("ingestion_runs")
      .update({ raw_input: normalized.expression_day.raw_input, normalized_payload: normalized, status: "revised", error_message: null, updated_at: nowIso() })
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .select("*")
      .single();
    if (error) raiseStoreError("supabase query", error);
    return normalizeIngestionRun(data as SupabaseIngestionRunRow);
  }

  async approveDraft(id: string, approvalText: string) {
    if (!isExplicitLessonSaveApproval(approvalText)) throw new Error("명시적인 저장 승인 문구가 필요합니다.");
    const run = requireEntity(await this.getIngestionRun(id), "Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트입니다.");

    const supabase = await this.supabase();
    const timestamp = nowIso();
    let dayId: string | null = null;
    let createdDayId: string | null = null;
    try {
      const requestedDayDate = run.normalized_payload.expression_day.day_date ?? null;
      const defaultFolderId = await resolveDefaultWritableFolder(supabase);
      if (requestedDayDate) {
        const { data: existingDay, error: existingDayError } = await supabase
          .from("expression_days")
          .select("id")
          .eq("owner_id", this.user.id)
          .eq("day_date", requestedDayDate)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (existingDayError) throw existingDayError;
        dayId = (existingDay?.id as string | undefined) ?? null;
      }

      if (!dayId) {
        const { data: dayRow, error: dayError } = await supabase
          .from("expression_days")
          .insert({
            owner_id: this.user.id,
            title: run.normalized_payload.expression_day.title,
            raw_input: run.normalized_payload.expression_day.raw_input,
            source_note: run.normalized_payload.expression_day.source_note ?? null,
            day_date: requestedDayDate,
            folder_id: defaultFolderId,
            created_by: "llm",
            updated_at: timestamp
          })
          .select("*")
          .single();
        if (dayError) throw dayError;
        dayId = dayRow.id as string;
        createdDayId = dayId;
      }

      const { data: existingExpressions, error: existingExpressionsError } = await supabase.from("expressions").select("source_order").eq("expression_day_id", dayId);
      if (existingExpressionsError) throw existingExpressionsError;
      const sourceOrderOffset = Math.max(-1, ...(existingExpressions ?? []).map((row: { source_order: number | null }) => row.source_order ?? -1)) + 1;

      const expressionRows = run.normalized_payload.expressions.map((card, index) => ({
        expression_day_id: dayId,
        owner_id: this.user.id,
        english: card.english,
        korean_prompt: card.korean_prompt,
        nuance_note: null,
        structure_note: null,
        grammar_note: normalizeGrammarNote(card.grammar_note),
        user_memo: null,
          source_order: sourceOrderOffset + index,
          updated_at: timestamp
      }));
      const { data: insertedExpressions, error: expressionError } = await supabase.from("expressions").insert(expressionRows).select("*");
      if (expressionError) throw expressionError;

      const exampleRows = (insertedExpressions ?? []).flatMap((card: { id: string }, cardIndex: number) =>
        (run.normalized_payload.expressions[cardIndex].examples ?? []).map((example, exampleIndex) => ({
          expression_id: card.id,
          example_text: example.example_text,
          meaning_ko: example.meaning_ko ?? null,
          source: example.source ?? "llm",
          sort_order: exampleIndex
        }))
      );
      if (exampleRows.length > 0) {
        const { error: exampleError } = await supabase.from("expression_examples").insert(exampleRows);
        if (exampleError) throw exampleError;
      }

      const { error: runError } = await supabase.from("ingestion_runs").update({ status: "inserted", error_message: null, updated_at: timestamp }).eq("id", id).eq("owner_id", this.user.id);
      if (runError) throw runError;

      const expressionDay = requireEntity(await this.getExpressionDay(dayId), "Saved expression day not found");
      return { expressionDay, expressionUrls: (insertedExpressions ?? []).map((card: ExpressionCard) => expressionUrl(card)) };
    } catch (error) {
      if (createdDayId) await supabase.from("expression_days").delete().eq("id", createdDayId).eq("owner_id", this.user.id);
      await supabase
        .from("ingestion_runs")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown ingestion error", updated_at: nowIso() })
        .eq("id", id)
        .eq("owner_id", this.user.id);
      throw error;
    }
  }

  async getIngestionRun(id: string) {
    const { data, error } = await (await this.supabase()).from("ingestion_runs").select("*").eq("id", id).eq("owner_id", this.user.id).maybeSingle();
    if (error) raiseStoreError("supabase query", error);
    return data ? normalizeIngestionRun(data as SupabaseIngestionRunRow) : null;
  }
}

type MemoryState = { expressionDays: ExpressionDay[]; expressionProgress: ExpressionProgress[]; ingestionRuns: IngestionRun[]; questionNotes: QuestionNote[] };
const globalMemory = globalThis as typeof globalThis & { __englishExpressionMemoryStore?: MemoryState };

export function resetMemoryLessonStoreForTests() {
  globalMemory.__englishExpressionMemoryStore = { expressionDays: [], expressionProgress: [], ingestionRuns: [], questionNotes: [] };
}
export const resetMemoryExpressionStoreForTests = resetMemoryLessonStoreForTests;

function memoryState() {
  globalMemory.__englishExpressionMemoryStore ??= { expressionDays: [], expressionProgress: [], ingestionRuns: [], questionNotes: [] };
  return globalMemory.__englishExpressionMemoryStore;
}

function cloneExpressionDay(day: ExpressionDay): ExpressionDay {
  return { ...day, expressions: day.expressions.map(cloneExpression) };
}
function cloneExpression(card: ExpressionCard): ExpressionCard {
  return { ...card, day: card.day ? { ...card.day } : undefined, examples: card.examples.map((example) => ({ ...example })) };
}
function cloneRun(run: IngestionRun): IngestionRun {
  return { ...run, normalized_payload: { ...run.normalized_payload, expression_day: { ...run.normalized_payload.expression_day }, expressions: run.normalized_payload.expressions.map((card) => ({ ...card, examples: card.examples?.map((e) => ({ ...e })) ?? [] })) } };
}

export class MemoryExpressionStore implements ExpressionStore {
  constructor(private readonly user: UserIdentity) {}

  private progressForExpression(expressionId: string) {
    return memoryState().expressionProgress.find((progress) => progress.user_id === this.user.id && progress.expression_id === expressionId) ?? null;
  }

  private cardWithProgress(card: ExpressionCard) {
    return applyProgress(card, this.progressForExpression(card.id));
  }

  async listExpressionDays() {
    return memoryState().expressionDays.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map((day) => ({
      ...cloneExpressionDay(day),
      expressions: day.expressions.map((card) => cloneExpression(this.cardWithProgress(card)))
    }));
  }

  async getExpressionDay(id: string) {
    const day = memoryState().expressionDays.find((item) => item.id === id);
    return day ? { ...cloneExpressionDay(day), expressions: day.expressions.map((card) => cloneExpression(this.cardWithProgress(card))) } : null;
  }

  async getExpression(id: string) {
    const located = this.findMutableExpression(id);
    if (!located) return null;
    return cloneExpression({ ...this.cardWithProgress(located.card), day: toDaySummary(located.day) });
  }

  private async listExpressions() {
    const days = await this.listExpressionDays();
    return days.flatMap((day) => day.expressions.map((card) => ({ ...card, day: toDaySummary(day) })));
  }

  async getMemorizationQueue(options: { limit?: number } = {}) {
    return scheduleMemorizationQueue(await this.listExpressions(), options.limit ?? 300).map(cloneExpression);
  }

  async getDashboardStats() {
    const [days, expressions, questions] = await Promise.all([this.listExpressionDays(), this.listExpressions(), this.listQuestionNotes()]);
    return calculateStats(days.length, expressions, questions);
  }

  async getDashboardOverview(options: { queueLimit?: number; recentDayLimit?: number } = {}) {
    const [days, expressions, questions] = await Promise.all([this.listExpressionDays(), this.listExpressions(), this.listQuestionNotes()]);
    return {
      stats: calculateStats(days.length, expressions, questions),
      recentDays: days.slice(0, options.recentDayLimit ?? 3).map(cloneExpressionDay),
      queue: scheduleMemorizationQueue(expressions, options.queueLimit ?? 3).map(cloneExpression)
    };
  }

  async recordReviewResult(id: string, result: "known" | "unknown") {
    const located = this.findMutableExpression(id);
    if (!located) throw new Error("Expression not found");
    const timestamp = nowIso();
    let progress = this.progressForExpression(id);
    if (!progress) {
      progress = defaultProgress(this.user.id, id, timestamp);
      memoryState().expressionProgress.push(progress);
    }
    const schedule = nextExpressionReviewSchedule(progress, result, new Date(timestamp));
    if (result === "known") {
      progress.known_count += 1;
    } else {
      progress.unknown_count += 1;
    }
    progress.interval_days = schedule.intervalDays;
    progress.due_at = schedule.dueAt;
    progress.review_count += 1;
    progress.last_result = result;
    progress.last_reviewed_at = timestamp;
    progress.updated_at = timestamp;
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async updateExpressionMemo(id: string, input: CardMemoInput) {
    const located = this.findMutableExpression(id);
    if (!located) throw new Error("Expression not found");
    const timestamp = nowIso();
    let progress = this.progressForExpression(id);
    if (!progress) {
      progress = defaultProgress(this.user.id, id, timestamp);
      memoryState().expressionProgress.push(progress);
    }
    progress.user_memo = input.userMemo || null;
    progress.updated_at = timestamp;
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async listQuestionNotes() {
    return memoryState()
      .questionNotes.filter((note) => note.owner_id === this.user.id)
      .sort((a, b) => b.status.localeCompare(a.status) || Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .map((note) => ({ ...note }));
  }

  async createQuestionNote(input: QuestionNoteInput) {
    const timestamp = nowIso();
    const status = input.status ?? (input.answerNote ? "answered" : "open");
    const note: QuestionNote = { id: randomUUID(), owner_id: this.user.id, question_text: input.questionText, answer_note: input.answerNote || null, status, created_at: timestamp, updated_at: timestamp };
    memoryState().questionNotes.unshift(note);
    return { ...note };
  }

  async updateQuestionNote(id: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }) {
    const note = memoryState().questionNotes.find((candidate) => candidate.id === id && candidate.owner_id === this.user.id);
    if (!note) throw new Error("Question note not found");
    if (input.questionText !== undefined) note.question_text = input.questionText;
    if (input.answerNote !== undefined) note.answer_note = input.answerNote || null;
    if (input.status !== undefined) note.status = input.status;
    note.updated_at = nowIso();
    return { ...note };
  }

  async createDraft(payload: ExpressionIngestionPayload) {
    const normalized = assertPayload(payload);
    const timestamp = nowIso();
    const run: IngestionRun = { id: randomUUID(), owner_id: this.user.id, raw_input: normalized.expression_day.raw_input, normalized_payload: normalized, status: "drafted", error_message: null, created_at: timestamp, updated_at: timestamp };
    memoryState().ingestionRuns.unshift(run);
    return cloneRun(run);
  }

  async reviseDraft(id: string, payload: ExpressionIngestionPayload) {
    const run = this.findMutableRun(id);
    if (!run) throw new Error("Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트는 수정할 수 없습니다.");
    const normalized = assertPayload(payload);
    run.raw_input = normalized.expression_day.raw_input;
    run.normalized_payload = normalized;
    run.status = "revised";
    run.error_message = null;
    run.updated_at = nowIso();
    return cloneRun(run);
  }

  async approveDraft(id: string, approvalText: string) {
    if (!isExplicitLessonSaveApproval(approvalText)) throw new Error("명시적인 저장 승인 문구가 필요합니다.");
    const run = this.findMutableRun(id);
    if (!run) throw new Error("Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트입니다.");

    const timestamp = nowIso();
    const requestedDayDate = run.normalized_payload.expression_day.day_date ?? null;
    let expressionDay = requestedDayDate
      ? memoryState().expressionDays.find((day) => day.owner_id === this.user.id && day.day_date === requestedDayDate)
      : undefined;

    if (!expressionDay) {
      expressionDay = {
        id: randomUUID(),
        owner_id: this.user.id,
        title: run.normalized_payload.expression_day.title,
        raw_input: run.normalized_payload.expression_day.raw_input,
        source_note: run.normalized_payload.expression_day.source_note ?? null,
        day_date: requestedDayDate,
        created_by: "llm",
        created_at: timestamp,
        updated_at: timestamp,
        expressions: []
      };
      memoryState().expressionDays.unshift(expressionDay);
    }

    const sourceOrderOffset = Math.max(-1, ...expressionDay.expressions.map((card) => card.source_order)) + 1;
    const insertedExpressions = run.normalized_payload.expressions.map((cardInput, index) => {
      const expressionId = randomUUID();
      return {
        id: expressionId,
        expression_day_id: expressionDay.id,
        owner_id: this.user.id,
        english: cardInput.english,
        korean_prompt: cardInput.korean_prompt,
        nuance_note: null,
        structure_note: null,
        grammar_note: normalizeGrammarNote(cardInput.grammar_note),
        user_memo: null,
        source_order: sourceOrderOffset + index,
        known_count: 0,
        unknown_count: 0,
        review_count: 0,
        last_result: null,
        last_reviewed_at: null,
        due_at: null,
        interval_days: 0,
        created_at: timestamp,
        updated_at: timestamp,
        examples: (cardInput.examples ?? []).map((exampleInput, exampleIndex) => ({
          id: randomUUID(),
          expression_id: expressionId,
          example_text: exampleInput.example_text,
          meaning_ko: exampleInput.meaning_ko ?? null,
          source: exampleInput.source ?? "llm",
          sort_order: exampleIndex,
          created_at: timestamp
        }))
      };
    });

    expressionDay.expressions.push(...insertedExpressions);
    expressionDay.updated_at = timestamp;
    run.status = "inserted";
    run.error_message = null;
    run.updated_at = timestamp;
    return { expressionDay: cloneExpressionDay(expressionDay), expressionUrls: insertedExpressions.map(expressionUrl) };
  }

  async getIngestionRun(id: string) {
    const run = memoryState().ingestionRuns.find((candidate) => candidate.id === id && candidate.owner_id === this.user.id);
    return run ? cloneRun(run) : null;
  }

  private findMutableRun(id: string) {
    return memoryState().ingestionRuns.find((run) => run.id === id && run.owner_id === this.user.id) ?? null;
  }

  private findMutableExpression(id: string) {
    for (const day of memoryState().expressionDays) {
      const card = day.expressions.find((candidate) => candidate.id === id);
      if (card) return { day, card };
    }
    return null;
  }
}

function toDaySummary(day: ExpressionDay): ExpressionDaySummary {
  return { id: day.id, title: day.title, source_note: day.source_note, day_date: day.day_date };
}

function calculateStats(dayCount: number, expressions: ExpressionStatsCard[], questions: QuestionStats[]): DashboardStats {
  return {
    total: expressions.length,
    knownReviews: expressions.reduce((sum, card) => sum + card.known_count, 0),
    unknownReviews: expressions.reduce((sum, card) => sum + card.unknown_count, 0),
    unseenCount: expressions.filter((card) => !card.last_reviewed_at).length,
    dueCount: scheduleMemorizationQueue(expressions, 300).length,
    dayCount,
    questionCount: questions.length,
    openQuestionCount: questions.filter((note) => note.status === "open").length
  };
}

export function getExpressionStore(user: UserIdentity): ExpressionStore {
  if (isE2EMemoryMode()) return new MemoryExpressionStore(user);
  return new SupabaseExpressionStore(user);
}

export function getAdminExpressionStore(user: UserIdentity): ExpressionStore {
  if (isE2EMemoryMode()) return new MemoryExpressionStore(user);
  return new SupabaseExpressionStore(user, createServiceRoleSupabaseClient);
}

// Backward-compatible names for existing imports while the app routes move to expression terminology.
export const MemoryLessonStore = MemoryExpressionStore;
export const getLessonStore = getExpressionStore;
export const getAdminLessonStore = getAdminExpressionStore;
export type LessonStore = ExpressionStore;
