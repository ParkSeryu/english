import { MissingSupabaseServiceRoleEnvError } from "@/lib/env";
import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { nextExpressionReviewSchedule, scheduleMemorizationQueue } from "@/lib/scheduling";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import type {
  CardMemoInput,
  PersonalExpressionInput,
  ContentFolderSummary,
  ExpressionCard,
  ExpressionDay,
  ExpressionDaySummary,
  ExpressionIngestionPayload,
  ExpressionProgress,
  PersonalExpressionUpdateInput,
  QuestionNote,
  QuestionNoteInput,
  QuestionNoteStatus,
  UserIdentity
} from "@/lib/types";
import type { ExpressionStore } from "@/lib/expression-store/contract";
import {
  isFolderSchemaUnavailableError,
  isMissingColumnError,
  isPermissionLikeError,
  logFolderSchemaFallback,
  raiseStoreError,
  requireEntity
} from "@/lib/expression-store/errors";
import {
  EXPRESSION_CARD_COLUMNS,
  EXPRESSION_DAY_COLUMNS,
  EXPRESSION_DAY_WITH_CARDS_SELECT,
  EXPRESSION_STATS_COLUMNS,
  EXPRESSION_WITH_DAY_SELECT,
  LEGACY_EXPRESSION_DAY_COLUMNS,
  LEGACY_EXPRESSION_DAY_WITH_CARDS_SELECT,
  LEGACY_EXPRESSION_WITH_DAY_SELECT,
  normalizeExpression,
  normalizeExpressionDay,
  normalizeFolder,
  normalizeIngestionRun,
  type SupabaseExpressionDayRow,
  type SupabaseExpressionRow,
  type SupabaseExpressionStatsRow,
  type SupabaseIngestionRunRow
} from "@/lib/expression-store/mappers";
import {
  applyProgress,
  assertPayload,
  calculateStats,
  defaultProgress,
  expressionStatsWithProgress,
  expressionUrl,
  normalizeGrammarNote,
  PERSONAL_EXPRESSION_MARKER,
  nowIso,
  type QuestionStats
} from "@/lib/expression-store/policies";

type SupabaseLike = Awaited<ReturnType<typeof createServerSupabaseClient>> | ReturnType<typeof createServiceRoleSupabaseClient>;

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

export class SupabaseExpressionStore implements ExpressionStore {
  constructor(
    private readonly user: UserIdentity,
    private readonly createClient: () => Promise<SupabaseLike> | SupabaseLike = createServerSupabaseClient
  ) {}

  private async supabase() {
    return this.createClient();
  }

  private serviceSupabaseOrNull() {
    try {
      return createServiceRoleSupabaseClient();
    } catch (error) {
      if (error instanceof MissingSupabaseServiceRoleEnvError) return null;
      throw error;
    }
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

  private async progressFor(expressionIds: string[], client?: SupabaseLike) {
    if (expressionIds.length === 0) return new Map<string, ExpressionProgress>();
    const { data, error } = await (client ?? await this.supabase())
      .from("expression_progress")
      .select("*")
      .eq("user_id", this.user.id)
      .in("expression_id", expressionIds);
    if (error) raiseStoreError("supabase query", error);
    return new Map((data ?? []).map((row: ExpressionProgress) => [row.expression_id, row]));
  }

  private async progressForOne(expressionId: string, client?: SupabaseLike) {
    const { data, error } = await (client ?? await this.supabase())
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
    return cards.map((card) => applyProgress(this.withDeletePermission(card), progress.get(card.id)));
  }

  private async upsertProgress(
    client: SupabaseLike,
    input: Omit<ExpressionProgress, "created_at">
  ) {
    const fullProgress = {
      user_id: input.user_id,
      expression_id: input.expression_id,
      user_memo: input.user_memo,
      is_memorization_enabled: input.is_memorization_enabled,
      known_count: input.known_count,
      unknown_count: input.unknown_count,
      review_count: input.review_count,
      last_result: input.last_result,
      last_reviewed_at: input.last_reviewed_at,
      due_at: input.due_at,
      interval_days: input.interval_days,
      updated_at: input.updated_at
    };
    const legacyProgress = {
      user_id: input.user_id,
      expression_id: input.expression_id,
      user_memo: input.user_memo,
      known_count: input.known_count,
      unknown_count: input.unknown_count,
      review_count: input.review_count,
      last_result: input.last_result,
      last_reviewed_at: input.last_reviewed_at,
      due_at: input.due_at,
      interval_days: input.interval_days,
      updated_at: input.updated_at
    };
    let error = (await client.from("expression_progress").upsert(fullProgress, { onConflict: "user_id,expression_id" })).error;
    if (error && isMissingColumnError(error, "is_memorization_enabled")) {
      error = (await client.from("expression_progress").upsert(legacyProgress, { onConflict: "user_id,expression_id" })).error;
    }
    return error;
  }

  private async upsertProgressWithFallback(input: Omit<ExpressionProgress, "created_at">, preferredClient?: SupabaseLike) {
    let client = preferredClient ?? await this.supabase();
    let error = await this.upsertProgress(client, input);
    if (error && isPermissionLikeError(error)) {
      const serviceSupabase = this.serviceSupabaseOrNull();
      if (serviceSupabase) {
        client = serviceSupabase;
        error = await this.upsertProgress(client, input);
      }
    }
    return { client, error };
  }

  private canDeleteExpression(card: ExpressionCard, day?: Pick<ExpressionDay | ExpressionDaySummary, "owner_id" | "created_by"> | null) {
    return card.owner_id === this.user.id && (card.user_memo === PERSONAL_EXPRESSION_MARKER || day?.created_by === "user" || card.owner_id !== day?.owner_id);
  }

  private withDeletePermission(card: ExpressionCard, day: ExpressionDay | ExpressionDaySummary | null | undefined = card.day) {
    return { ...card, can_delete: this.canDeleteExpression(card, day) };
  }

  private async mergeOwnServiceExpressions(days: ExpressionDay[]) {
    const serviceSupabase = this.serviceSupabaseOrNull();
    const dayIds = days.map((day) => day.id);
    if (!serviceSupabase || dayIds.length === 0) return days;

    let { data, error } = await serviceSupabase
      .from("expressions")
      .select(EXPRESSION_WITH_DAY_SELECT)
      .eq("owner_id", this.user.id)
      .in("expression_day_id", dayIds);
    if (error && isFolderSchemaUnavailableError(error)) {
      logFolderSchemaFallback("mergeOwnServiceExpressions", error);
      const legacyResult = await serviceSupabase
        .from("expressions")
        .select(LEGACY_EXPRESSION_WITH_DAY_SELECT)
        .eq("owner_id", this.user.id)
        .in("expression_day_id", dayIds);
      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }
    if (error) return days;

    const ownCards = await this.hydrateExpressionCards((data ?? []).map((row: SupabaseExpressionRow) => normalizeExpression(row)));
    const progress = await this.progressFor(ownCards.map((card) => card.id), serviceSupabase);
    const ownCardsByDay = new Map<string, ExpressionCard[]>();
    for (const card of ownCards) {
      const dayId = card.expression_day_id;
      ownCardsByDay.set(dayId, [...(ownCardsByDay.get(dayId) ?? []), applyProgress(this.withDeletePermission(card), progress.get(card.id))]);
    }

    return days.map((day) => {
      const existingIds = new Set(day.expressions.map((card) => card.id));
      const missingOwnCards = (ownCardsByDay.get(day.id) ?? []).filter((card) => !existingIds.has(card.id));
      if (missingOwnCards.length === 0) return day;
      return {
        ...day,
        expressions: [...day.expressions, ...missingOwnCards].sort((a, b) => a.source_order - b.source_order)
      };
    });
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
    const days = await this.mergeOwnServiceExpressions(await this.hydrateExpressionDays((data ?? []).map((row: SupabaseExpressionDayRow) => normalizeExpressionDay(row))));
    const progress = await this.progressFor(days.flatMap((day) => day.expressions.map((card) => card.id)));
    return days.map((day) => ({ ...day, expressions: day.expressions.map((card) => applyProgress(this.withDeletePermission(card, day), progress.get(card.id))) }));
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
    const [day] = await this.mergeOwnServiceExpressions(await this.hydrateExpressionDays([normalizeExpressionDay(data as SupabaseExpressionDayRow)]));
    const progress = await this.progressFor(day.expressions.map((card) => card.id));
    return { ...day, expressions: day.expressions.map((card) => applyProgress(this.withDeletePermission(card, day), progress.get(card.id))) };
  }

  async getExpression(id: string) {
    const supabase = await this.contentSupabase();
    let readSupabase: SupabaseLike = supabase;
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
    if (!data) {
      const serviceSupabase = this.serviceSupabaseOrNull();
      if (serviceSupabase) {
        readSupabase = serviceSupabase;
        const serviceResult = await serviceSupabase
          .from("expressions")
          .select(EXPRESSION_WITH_DAY_SELECT)
          .eq("id", id)
          .maybeSingle();
        data = serviceResult.data as typeof data;
        error = serviceResult.error;
        if (error && isFolderSchemaUnavailableError(error)) {
          logFolderSchemaFallback("getExpression", error);
          const legacyResult = await serviceSupabase
            .from("expressions")
            .select(LEGACY_EXPRESSION_WITH_DAY_SELECT)
            .eq("id", id)
            .maybeSingle();
          data = legacyResult.data as typeof data;
          error = legacyResult.error;
        }
        if (error) raiseStoreError("supabase query", error);
        if (data && (data as SupabaseExpressionRow).owner_id !== this.user.id) return null;
      }
    }
    if (!data) return null;
    const [card] = await this.hydrateExpressionCards([normalizeExpression(data as SupabaseExpressionRow)]);
    return applyProgress(this.withDeletePermission(card), await this.progressForOne(card.id, readSupabase));
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
    const cards = await this.hydrateExpressionCards((data ?? []).map((row: SupabaseExpressionRow) => normalizeExpression(row)));
    const serviceSupabase = this.serviceSupabaseOrNull();
    if (!serviceSupabase) return this.applyUserProgress(cards);

    let ownData: unknown[] | null = null;
    let ownError: unknown = null;
    const ownResult = await serviceSupabase.from("expressions").select(EXPRESSION_WITH_DAY_SELECT).eq("owner_id", this.user.id);
    ownData = ownResult.data;
    ownError = ownResult.error;
    if (ownError && isFolderSchemaUnavailableError(ownError)) {
      logFolderSchemaFallback("listExpressions", ownError);
      const legacyOwnResult = await serviceSupabase.from("expressions").select(LEGACY_EXPRESSION_WITH_DAY_SELECT).eq("owner_id", this.user.id);
      ownData = legacyOwnResult.data;
      ownError = legacyOwnResult.error;
    }
    if (ownError) return this.applyUserProgress(cards);

    const existingIds = new Set(cards.map((card) => card.id));
    const ownCards = await this.hydrateExpressionCards((ownData ?? []).map((row) => normalizeExpression(row as SupabaseExpressionRow)));
    return this.applyUserProgress([...cards, ...ownCards.filter((card) => !existingIds.has(card.id))]);
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
      return { ...day, expressions: day.expressions.map((card) => applyProgress(this.withDeletePermission(card, day), null)) };
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
          is_memorization_enabled: current.is_memorization_enabled,
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
    const { error } = await this.upsertProgressWithFallback({
      user_id: this.user.id,
      expression_id: id,
      user_memo: input.userMemo || null,
      is_memorization_enabled: input.isMemorizationEnabled ?? current.is_memorization_enabled,
      known_count: current.known_count,
      unknown_count: current.unknown_count,
      review_count: current.review_count,
      last_result: current.last_result,
      last_reviewed_at: current.last_reviewed_at,
      due_at: current.due_at,
      interval_days: current.interval_days,
      updated_at: timestamp
    });
    if (error) raiseStoreError("supabase query", error);
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async createPersonalExpression(input: PersonalExpressionInput) {
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const targetDayId = input.targetExpressionDayId ?? null;
    if (!targetDayId) throw new Error("학습 토픽을 선택해 주세요.");

    const targetDay = requireEntity(await this.getExpressionDay(targetDayId), "학습 토픽을 찾을 수 없습니다.");
    const sourceOrder = targetDay.expressions.reduce((max, expression) => Math.max(max, expression.source_order), -1) + 1;
    const grammarNote = normalizeGrammarNote(input.grammarNote);

    const expressionInsert = {
      expression_day_id: targetDayId,
      owner_id: this.user.id,
      english: input.english,
      korean_prompt: input.koreanPrompt,
      nuance_note: null,
      structure_note: null,
      grammar_note: grammarNote,
      user_memo: PERSONAL_EXPRESSION_MARKER,
      source_order: sourceOrder,
      updated_at: timestamp
    };
    let writeSupabase = supabase;
    const serviceSupabase = this.serviceSupabaseOrNull();
    const lookupSupabase = serviceSupabase ?? supabase;
    let existingQuery = lookupSupabase
      .from("expressions")
      .select("*")
      .eq("expression_day_id", targetDayId)
      .eq("owner_id", this.user.id)
      .eq("user_memo", PERSONAL_EXPRESSION_MARKER)
      .eq("english", input.english)
      .eq("korean_prompt", input.koreanPrompt)
      .order("created_at", { ascending: false })
      .limit(1);
    existingQuery = grammarNote ? existingQuery.eq("grammar_note", grammarNote) : existingQuery.is("grammar_note", null);
    const { data: existingRows, error: existingError } = await existingQuery;
    if (existingError && !isPermissionLikeError(existingError)) raiseStoreError("supabase query", existingError);

    let expressionRow = existingRows?.[0] ?? null;
    if (!expressionRow) {
      let expressionError;
      ({ data: expressionRow, error: expressionError } = await writeSupabase.from("expressions").insert(expressionInsert).select("*").single());

      if (expressionError && isPermissionLikeError(expressionError) && serviceSupabase) {
        writeSupabase = serviceSupabase;
        const serviceResult = await writeSupabase.from("expressions").insert(expressionInsert).select("*").single();
        expressionRow = serviceResult.data;
        expressionError = serviceResult.error;
      }
      if (expressionError) raiseStoreError("supabase query", expressionError);
    }
    if (!expressionRow?.id) throw new Error("Expression not found");

    const { error: progressError } = await this.upsertProgressWithFallback({
      user_id: this.user.id,
      expression_id: expressionRow.id,
      user_memo: input.userMemo || null,
      is_memorization_enabled: input.isMemorizationEnabled ?? false,
      known_count: 0,
      unknown_count: 0,
      review_count: 0,
      last_result: null,
      last_reviewed_at: null,
      due_at: null,
      interval_days: 0,
      updated_at: timestamp
    }, writeSupabase);

    if (progressError) {
      await writeSupabase.from("expressions").delete().eq("id", expressionRow.id).eq("owner_id", this.user.id);
      raiseStoreError("supabase query", progressError);
    }

    return requireEntity(await this.getExpression(expressionRow.id as string), "Expression not found");
  }

  async updatePersonalExpression(id: string, input: PersonalExpressionUpdateInput) {
    const existing = requireEntity(await this.getExpression(id), "Expression not found");
    if (!existing.can_delete) throw new Error("직접 추가한 표현만 수정할 수 있습니다.");

    const supabase = await this.supabase();
    const writeSupabase = this.serviceSupabaseOrNull() ?? supabase;
    const timestamp = nowIso();
    const { data: updatedRows, error } = await writeSupabase
      .from("expressions")
      .update({
        english: input.english,
        korean_prompt: input.koreanPrompt,
        grammar_note: normalizeGrammarNote(input.grammarNote),
        user_memo: PERSONAL_EXPRESSION_MARKER,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .select("id");
    if (error) raiseStoreError("supabase query", error);
    if ((updatedRows ?? []).length === 0) throw new Error("표현을 수정하지 못했습니다. 다시 시도해 주세요.");

    const current = (await this.progressForOne(id, writeSupabase)) ?? defaultProgress(this.user.id, id, existing.created_at);
    const { error: progressError } = await this.upsertProgressWithFallback({
      user_id: this.user.id,
      expression_id: id,
      user_memo: input.userMemo || null,
      is_memorization_enabled: input.isMemorizationEnabled ?? current.is_memorization_enabled,
      known_count: current.known_count,
      unknown_count: current.unknown_count,
      review_count: current.review_count,
      last_result: current.last_result,
      last_reviewed_at: current.last_reviewed_at,
      due_at: current.due_at,
      interval_days: current.interval_days,
      updated_at: timestamp
    }, writeSupabase);
    if (progressError) raiseStoreError("supabase query", progressError);

    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async deletePersonalExpression(id: string) {
    const expression = await this.getExpression(id);
    if (!expression) throw new Error("Expression not found");
    if (!expression.can_delete) throw new Error("직접 추가한 표현만 삭제할 수 있습니다.");

    const supabase = await this.supabase();
    const writeSupabase = this.serviceSupabaseOrNull() ?? supabase;
    const { data: deletedRows, error } = await writeSupabase
      .from("expressions")
      .delete()
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .select("id");
    if (error) raiseStoreError("supabase query", error);
    if ((deletedRows ?? []).length === 0) throw new Error("표현을 삭제하지 못했습니다. 다시 시도해 주세요.");
    await writeSupabase.from("expression_progress").delete().eq("expression_id", id).eq("user_id", this.user.id);
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

