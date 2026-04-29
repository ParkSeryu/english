import { randomUUID } from "node:crypto";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { nextDueAtForKnown, nextDueAtForUnknown, nextKnownIntervalDays, scheduleMemorizationQueue } from "@/lib/scheduling";
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

type SupabaseExpressionRow = Omit<ExpressionCard, "examples" | "day"> & {
  expression_examples?: ExpressionExample[] | null;
  expression_days?: ExpressionDaySummary | null;
};

type SupabaseExpressionDayRow = Omit<ExpressionDay, "expressions"> & {
  expressions?: SupabaseExpressionRow[] | null;
};

type SupabaseIngestionRunRow = Omit<IngestionRun, "normalized_payload"> & { normalized_payload: unknown };

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

function normalizeExpression(row: SupabaseExpressionRow): ExpressionCard {
  const { expression_examples: examples, expression_days, ...expression } = row;
  return {
    ...expression,
    day: expression_days ?? undefined,
    examples: [...(examples ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  };
}

function normalizeExpressionDay(row: SupabaseExpressionDayRow): ExpressionDay {
  const { expressions, ...day } = row;
  return {
    ...day,
    expressions: [...(expressions ?? [])].map(normalizeExpression).sort((a, b) => a.source_order - b.source_order)
  };
}

function normalizeIngestionRun(row: SupabaseIngestionRunRow): IngestionRun {
  return { ...row, normalized_payload: assertPayload(row.normalized_payload as ExpressionIngestionPayload) };
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

  private async progressFor(expressionIds: string[]) {
    if (expressionIds.length === 0) return new Map<string, ExpressionProgress>();
    const { data, error } = await (await this.supabase())
      .from("expression_progress")
      .select("*")
      .eq("user_id", this.user.id)
      .in("expression_id", expressionIds);
    if (error) throw error;
    return new Map((data ?? []).map((row: ExpressionProgress) => [row.expression_id, row]));
  }

  private async progressForOne(expressionId: string) {
    const { data, error } = await (await this.supabase())
      .from("expression_progress")
      .select("*")
      .eq("user_id", this.user.id)
      .eq("expression_id", expressionId)
      .maybeSingle();
    if (error) throw error;
    return (data as ExpressionProgress | null) ?? null;
  }

  private async applyUserProgress(cards: ExpressionCard[]) {
    const progress = await this.progressFor(cards.map((card) => card.id));
    return cards.map((card) => applyProgress(card, progress.get(card.id)));
  }

  async listExpressionDays() {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("expression_days")
      .select("*, expressions(*, expression_examples(*))")
      .order("day_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    const days = (data ?? []).map((row: SupabaseExpressionDayRow) => normalizeExpressionDay(row));
    const progress = await this.progressFor(days.flatMap((day) => day.expressions.map((card) => card.id)));
    return days.map((day) => ({ ...day, expressions: day.expressions.map((card) => applyProgress(card, progress.get(card.id))) }));
  }

  async getExpressionDay(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("expression_days")
      .select("*, expressions(*, expression_examples(*))")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const day = normalizeExpressionDay(data as SupabaseExpressionDayRow);
    const progress = await this.progressFor(day.expressions.map((card) => card.id));
    return { ...day, expressions: day.expressions.map((card) => applyProgress(card, progress.get(card.id))) };
  }

  async getExpression(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("expressions")
      .select("*, expression_examples(*), expression_days(id,title,source_note,day_date)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const card = normalizeExpression(data as SupabaseExpressionRow);
    return applyProgress(card, await this.progressForOne(card.id));
  }

  private async listExpressions() {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("expressions")
      .select("*, expression_examples(*), expression_days(id,title,source_note,day_date)")
      .order("source_order", { ascending: true });
    if (error) throw error;
    return this.applyUserProgress((data ?? []).map((row: SupabaseExpressionRow) => normalizeExpression(row)));
  }

  async getMemorizationQueue(options: { limit?: number } = {}) {
    return scheduleMemorizationQueue(await this.listExpressions(), options.limit ?? 300);
  }

  async getDashboardStats() {
    const [days, expressions, questions] = await Promise.all([this.listExpressionDays(), this.listExpressions(), this.listQuestionNotes()]);
    return calculateStats(days, expressions, questions);
  }

  async getDashboardOverview(options: { queueLimit?: number; recentDayLimit?: number } = {}) {
    const [days, expressions, questions] = await Promise.all([this.listExpressionDays(), this.listExpressions(), this.listQuestionNotes()]);
    return {
      stats: calculateStats(days, expressions, questions),
      recentDays: days.slice(0, options.recentDayLimit ?? 3),
      queue: scheduleMemorizationQueue(expressions, options.queueLimit ?? 3)
    };
  }

  async recordReviewResult(id: string, result: "known" | "unknown") {
    const existing = requireEntity(await this.getExpression(id), "Expression not found");
    const current = (await this.progressForOne(id)) ?? defaultProgress(this.user.id, id, existing.created_at);
    const timestamp = nowIso();
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
          interval_days: result === "known" ? nextKnownIntervalDays(current.interval_days) : 0,
          due_at: result === "known" ? nextDueAtForKnown(nextKnownIntervalDays(current.interval_days), new Date(timestamp)) : nextDueAtForUnknown(),
          updated_at: timestamp
        },
        { onConflict: "user_id,expression_id" }
      );
    if (error) throw error;
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
    if (error) throw error;
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async listQuestionNotes() {
    const { data, error } = await (await this.supabase())
      .from("question_notes")
      .select("*")
      .eq("owner_id", this.user.id)
      .order("status", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as QuestionNote[];
  }

  async createQuestionNote(input: QuestionNoteInput) {
    const timestamp = nowIso();
    const { data, error } = await (await this.supabase())
      .from("question_notes")
      .insert({ owner_id: this.user.id, question_text: input.questionText, answer_note: input.answerNote || null, status: "open", updated_at: timestamp })
      .select("*")
      .single();
    if (error) throw error;
    return data as QuestionNote;
  }

  async updateQuestionNote(id: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }) {
    const patch: Record<string, string | null> = { updated_at: nowIso() };
    if (input.questionText !== undefined) patch.question_text = input.questionText;
    if (input.answerNote !== undefined) patch.answer_note = input.answerNote || null;
    if (input.status !== undefined) patch.status = input.status;
    const { data, error } = await (await this.supabase()).from("question_notes").update(patch).eq("id", id).eq("owner_id", this.user.id).select("*").single();
    if (error) throw error;
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
    if (error) throw error;
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
    if (error) throw error;
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
    if (error) throw error;
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
    return calculateStats(await this.listExpressionDays(), await this.listExpressions(), await this.listQuestionNotes());
  }

  async getDashboardOverview(options: { queueLimit?: number; recentDayLimit?: number } = {}) {
    const [days, expressions, questions] = await Promise.all([this.listExpressionDays(), this.listExpressions(), this.listQuestionNotes()]);
    return {
      stats: calculateStats(days, expressions, questions),
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
    if (result === "known") {
      progress.known_count += 1;
      progress.interval_days = nextKnownIntervalDays(progress.interval_days);
      progress.due_at = nextDueAtForKnown(progress.interval_days, new Date(timestamp));
    } else {
      progress.unknown_count += 1;
      progress.interval_days = 0;
      progress.due_at = nextDueAtForUnknown();
    }
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
    const note: QuestionNote = { id: randomUUID(), owner_id: this.user.id, question_text: input.questionText, answer_note: input.answerNote || null, status: "open", created_at: timestamp, updated_at: timestamp };
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

function calculateStats(days: ExpressionDay[], expressions: ExpressionCard[], questions: QuestionNote[]): DashboardStats {
  return {
    total: expressions.length,
    knownReviews: expressions.reduce((sum, card) => sum + card.known_count, 0),
    unknownReviews: expressions.reduce((sum, card) => sum + card.unknown_count, 0),
    unseenCount: expressions.filter((card) => !card.last_reviewed_at).length,
    dueCount: scheduleMemorizationQueue(expressions, 300).length,
    dayCount: days.length,
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
