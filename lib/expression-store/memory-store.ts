import { randomUUID } from "node:crypto";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { nextExpressionReviewSchedule, scheduleMemorizationQueue } from "@/lib/scheduling";
import type {
  CardMemoInput,
  PersonalExpressionInput,
  PersonalExpressionUpdateInput,
  ExpressionCard,
  ExpressionDay,
  ExpressionIngestionPayload,
  ExpressionProgress,
  IngestionRun,
  QuestionNote,
  QuestionNoteInput,
  QuestionNoteStatus,
  UserIdentity
} from "@/lib/types";
import type { ExpressionStore } from "@/lib/expression-store/contract";
import { requireEntity } from "@/lib/expression-store/errors";
import {
  applyProgress,
  assertPayload,
  calculateStats,
  defaultProgress,
  expressionUrl,
  normalizeGrammarNote,
  PERSONAL_EXPRESSION_MARKER,
  nowIso,
  toDaySummary
} from "@/lib/expression-store/policies";

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

  private cardWithProgress(card: ExpressionCard, day?: ExpressionDay) {
    return applyProgress({ ...card, can_delete: this.canDeleteExpression(day, card) }, this.progressForExpression(card.id));
  }

  private canReadDay(day: ExpressionDay) {
    return day.created_by === "llm" || day.owner_id === this.user.id;
  }

  private canReadExpression(day: ExpressionDay, card: ExpressionCard) {
    return card.owner_id === this.user.id || card.owner_id === day.owner_id;
  }

  private canDeleteExpression(day: ExpressionDay | undefined, card: ExpressionCard) {
    return card.owner_id === this.user.id && (card.user_memo === PERSONAL_EXPRESSION_MARKER || day?.created_by === "user" || card.owner_id !== day?.owner_id);
  }

  private visibleExpressions(day: ExpressionDay) {
    return day.expressions.filter((card) => this.canReadExpression(day, card));
  }

  async listExpressionDays() {
    return memoryState().expressionDays.filter((day) => this.canReadDay(day)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map((day) => ({
      ...cloneExpressionDay(day),
      expressions: this.visibleExpressions(day).map((card) => cloneExpression(this.cardWithProgress(card, day)))
    }));
  }

  async getExpressionDay(id: string) {
    const day = memoryState().expressionDays.find((item) => item.id === id && this.canReadDay(item));
    return day ? { ...cloneExpressionDay(day), expressions: this.visibleExpressions(day).map((card) => cloneExpression(this.cardWithProgress(card, day))) } : null;
  }

  async getExpression(id: string) {
    const located = this.findMutableExpression(id);
    if (!located) return null;
    return cloneExpression({ ...this.cardWithProgress(located.card, located.day), day: toDaySummary(located.day) });
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
    progress.is_memorization_enabled = input.isMemorizationEnabled ?? progress.is_memorization_enabled;
    progress.updated_at = timestamp;
    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async createPersonalExpression(input: PersonalExpressionInput) {
    const timestamp = nowIso();
    const expressionId = randomUUID();
    if (!input.targetExpressionDayId) throw new Error("학습 토픽을 선택해 주세요.");
    const expressionDay = memoryState().expressionDays.find((day) => day.id === input.targetExpressionDayId && this.canReadDay(day)) ?? null;
    if (!expressionDay) throw new Error("학습 토픽을 찾을 수 없습니다.");
    const sourceOrder = expressionDay.expressions.reduce((max, expression) => Math.max(max, expression.source_order), -1) + 1;

    const expression: ExpressionCard = {
      id: expressionId,
      expression_day_id: expressionDay.id,
      owner_id: this.user.id,
      english: input.english,
      korean_prompt: input.koreanPrompt,
      nuance_note: null,
      structure_note: null,
      grammar_note: normalizeGrammarNote(input.grammarNote),
      user_memo: PERSONAL_EXPRESSION_MARKER,
      is_memorization_enabled: true,
      source_order: sourceOrder,
      known_count: 0,
      unknown_count: 0,
      review_count: 0,
      last_result: null,
      last_reviewed_at: null,
      due_at: null,
      interval_days: 0,
      created_at: timestamp,
      updated_at: timestamp,
      examples: []
    };
    expressionDay.expressions.push(expression);
    expressionDay.updated_at = timestamp;
    memoryState().expressionProgress.push({
      ...defaultProgress(this.user.id, expressionId, timestamp),
      user_memo: input.userMemo || null,
      is_memorization_enabled: input.isMemorizationEnabled ?? true
    });
    return requireEntity(await this.getExpression(expressionId), "Expression not found");
  }

  async updatePersonalExpression(id: string, input: PersonalExpressionUpdateInput) {
    const located = this.findMutableExpression(id);
    if (!located) throw new Error("Expression not found");
    if (!this.canDeleteExpression(located.day, located.card)) throw new Error("직접 추가한 표현만 수정할 수 있습니다.");

    const timestamp = nowIso();
    located.card.english = input.english;
    located.card.korean_prompt = input.koreanPrompt;
    located.card.grammar_note = normalizeGrammarNote(input.grammarNote);
    located.card.user_memo = PERSONAL_EXPRESSION_MARKER;
    located.card.updated_at = timestamp;
    located.day.updated_at = timestamp;

    let progress = this.progressForExpression(id);
    if (!progress) {
      progress = defaultProgress(this.user.id, id, located.card.created_at);
      memoryState().expressionProgress.push(progress);
    }
    progress.user_memo = input.userMemo || null;
    progress.is_memorization_enabled = input.isMemorizationEnabled ?? progress.is_memorization_enabled;
    progress.updated_at = timestamp;

    return requireEntity(await this.getExpression(id), "Expression not found");
  }

  async deletePersonalExpression(id: string) {
    const located = this.findMutableExpression(id);
    if (!located) throw new Error("Expression not found");
    if (!this.canDeleteExpression(located.day, located.card)) throw new Error("직접 추가한 표현만 삭제할 수 있습니다.");

    located.day.expressions = located.day.expressions.filter((expression) => expression.id !== id);
    located.day.updated_at = nowIso();
    const state = memoryState();
    state.expressionProgress = state.expressionProgress.filter((progress) => progress.expression_id !== id);
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
        is_memorization_enabled: true,
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
      if (!this.canReadDay(day)) continue;
      const card = day.expressions.find((candidate) => candidate.id === id && this.canReadExpression(day, candidate));
      if (card) return { day, card };
    }
    return null;
  }
}

