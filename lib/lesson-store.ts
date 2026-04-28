import { randomUUID } from "node:crypto";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { scheduleReviewQueue } from "@/lib/scheduling";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isE2EMemoryMode } from "@/lib/test-mode";
import { lessonIngestionPayloadSchema } from "@/lib/validation";
import type {
  ApprovedLessonResult,
  DashboardStats,
  IngestionRun,
  ItemNotesInput,
  Lesson,
  LessonIngestionPayload,
  LessonSummary,
  StudyExample,
  StudyItem,
  StudyStatus,
  UserIdentity
} from "@/lib/types";

type SupabaseLike = Awaited<ReturnType<typeof createServerSupabaseClient>> | ReturnType<typeof createServiceRoleSupabaseClient>;

type SupabaseStudyItemRow = Omit<StudyItem, "examples" | "lesson"> & {
  study_examples?: StudyExample[] | null;
  lessons?: LessonSummary | null;
};

type SupabaseLessonRow = Omit<Lesson, "items"> & {
  study_items?: SupabaseStudyItemRow[] | null;
};

type SupabaseIngestionRunRow = Omit<IngestionRun, "normalized_payload"> & {
  normalized_payload: unknown;
};

export interface LessonStore {
  listLessons(): Promise<Lesson[]>;
  getLesson(id: string): Promise<Lesson | null>;
  getItem(id: string): Promise<StudyItem | null>;
  getReviewQueue(options?: { confusingOnly?: boolean; limit?: number }): Promise<StudyItem[]>;
  getDashboardStats(): Promise<DashboardStats>;
  markReviewed(id: string, status: Exclude<StudyStatus, "new">): Promise<StudyItem>;
  updateItemNotes(id: string, input: ItemNotesInput): Promise<StudyItem>;
  createDraft(payload: LessonIngestionPayload): Promise<IngestionRun>;
  reviseDraft(id: string, payload: LessonIngestionPayload): Promise<IngestionRun>;
  approveDraft(id: string, approvalText: string): Promise<ApprovedLessonResult>;
  getIngestionRun(id: string): Promise<IngestionRun | null>;
}

function nowIso() {
  return new Date().toISOString();
}

function assertPayload(payload: LessonIngestionPayload) {
  return lessonIngestionPayloadSchema.parse(payload);
}

function normalizeStudyItem(row: SupabaseStudyItemRow): StudyItem {
  const { study_examples: examples, lessons, ...item } = row;
  return {
    ...item,
    lesson: lessons ?? undefined,
    examples: [...(examples ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  };
}

function normalizeLesson(row: SupabaseLessonRow): Lesson {
  const { study_items: items, ...lesson } = row;
  return {
    ...lesson,
    items: [...(items ?? [])]
      .map((item) => normalizeStudyItem(item))
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  };
}

function normalizeIngestionRun(row: SupabaseIngestionRunRow): IngestionRun {
  return {
    ...row,
    normalized_payload: assertPayload(row.normalized_payload as LessonIngestionPayload)
  };
}

function requireEntity<T>(entity: T | null | undefined, message: string): T {
  if (!entity) throw new Error(message);
  return entity;
}

function itemUrl(item: StudyItem) {
  return `/items/${item.id}`;
}

class SupabaseLessonStore implements LessonStore {
  constructor(
    private readonly user: UserIdentity,
    private readonly createClient: () => Promise<SupabaseLike> | SupabaseLike = createServerSupabaseClient
  ) {}

  private async supabase() {
    return this.createClient();
  }

  async listLessons() {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("lessons")
      .select("*, study_items(*, study_examples(*))")
      .eq("owner_id", this.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row: SupabaseLessonRow) => normalizeLesson(row));
  }

  async getLesson(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("lessons")
      .select("*, study_items(*, study_examples(*))")
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeLesson(data as SupabaseLessonRow) : null;
  }

  async getItem(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("study_items")
      .select("*, study_examples(*), lessons(id,title,source_note,lesson_date)")
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeStudyItem(data as SupabaseStudyItemRow) : null;
  }

  private async listItems(status?: StudyStatus) {
    const supabase = await this.supabase();
    let query = supabase
      .from("study_items")
      .select("*, study_examples(*), lessons(id,title,source_note,lesson_date)")
      .eq("owner_id", this.user.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: SupabaseStudyItemRow) => normalizeStudyItem(row));
  }

  async getReviewQueue(options: { confusingOnly?: boolean; limit?: number } = {}) {
    const items = await this.listItems(options.confusingOnly ? "confusing" : undefined);
    return scheduleReviewQueue(items, options.limit ?? 10);
  }

  async getDashboardStats() {
    const [lessons, items] = await Promise.all([this.listLessons(), this.listItems()]);
    return calculateStats(lessons, items);
  }

  async markReviewed(id: string, status: Exclude<StudyStatus, "new">) {
    const existing = requireEntity(await this.getItem(id), "Study item not found");
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { error } = await supabase
      .from("study_items")
      .update({
        status,
        last_reviewed_at: timestamp,
        review_count: existing.review_count + 1,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id);

    if (error) throw error;
    return requireEntity(await this.getItem(id), "Study item not found");
  }

  async updateItemNotes(id: string, input: ItemNotesInput) {
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { error } = await supabase
      .from("study_items")
      .update({
        user_memo: input.userMemo || null,
        confusion_note: input.confusionNote || null,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id);

    if (error) throw error;
    return requireEntity(await this.getItem(id), "Study item not found");
  }

  async createDraft(payload: LessonIngestionPayload) {
    const normalized = assertPayload(payload);
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { data, error } = await supabase
      .from("ingestion_runs")
      .insert({
        owner_id: this.user.id,
        raw_input: normalized.lesson.raw_input,
        normalized_payload: normalized,
        status: "drafted",
        updated_at: timestamp
      })
      .select("*")
      .single();

    if (error) throw error;
    return normalizeIngestionRun(data as SupabaseIngestionRunRow);
  }

  async reviseDraft(id: string, payload: LessonIngestionPayload) {
    const existing = requireEntity(await this.getIngestionRun(id), "Ingestion draft not found");
    if (existing.status === "inserted") throw new Error("이미 저장된 드래프트는 수정할 수 없습니다.");

    const normalized = assertPayload(payload);
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { data, error } = await supabase
      .from("ingestion_runs")
      .update({
        raw_input: normalized.lesson.raw_input,
        normalized_payload: normalized,
        status: "revised",
        error_message: null,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .select("*")
      .single();

    if (error) throw error;
    return normalizeIngestionRun(data as SupabaseIngestionRunRow);
  }

  async approveDraft(id: string, approvalText: string) {
    if (!isExplicitLessonSaveApproval(approvalText)) {
      throw new Error("명시적인 저장 승인 문구가 필요합니다.");
    }

    const run = requireEntity(await this.getIngestionRun(id), "Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트입니다.");

    const supabase = await this.supabase();
    const timestamp = nowIso();
    let lessonId: string | null = null;

    try {
      const { data: lessonRow, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          owner_id: this.user.id,
          title: run.normalized_payload.lesson.title,
          raw_input: run.normalized_payload.lesson.raw_input,
          source_note: run.normalized_payload.lesson.source_note ?? null,
          lesson_date: run.normalized_payload.lesson.lesson_date ?? null,
          created_by: "llm",
          updated_at: timestamp
        })
        .select("*")
        .single();

      if (lessonError) throw lessonError;
      lessonId = lessonRow.id as string;

      const itemRows = run.normalized_payload.items.map((item) => ({
        lesson_id: lessonId,
        owner_id: this.user.id,
        expression: item.expression,
        meaning_ko: item.meaning_ko,
        core_nuance: item.core_nuance ?? null,
        structure_note: item.structure_note ?? null,
        grammar_note: item.grammar_note ?? null,
        user_memo: item.user_memo ?? null,
        confusion_note: item.confusion_note ?? null,
        status: "new" as const,
        updated_at: timestamp
      }));

      const { data: insertedItems, error: itemError } = await supabase.from("study_items").insert(itemRows).select("*");
      if (itemError) throw itemError;

      const exampleRows = (insertedItems ?? []).flatMap((item: { id: string }, itemIndex: number) =>
        run.normalized_payload.items[itemIndex].examples.map((example, exampleIndex) => ({
          study_item_id: item.id,
          example_text: example.example_text,
          meaning_ko: example.meaning_ko ?? null,
          source: example.source ?? "llm",
          sort_order: exampleIndex
        }))
      );

      if (exampleRows.length > 0) {
        const { error: exampleError } = await supabase.from("study_examples").insert(exampleRows);
        if (exampleError) throw exampleError;
      }

      const { error: runError } = await supabase
        .from("ingestion_runs")
        .update({ status: "inserted", error_message: null, updated_at: timestamp })
        .eq("id", id)
        .eq("owner_id", this.user.id);
      if (runError) throw runError;

      const lesson = requireEntity(await this.getLesson(lessonId), "Saved lesson not found");
      return { lesson, itemUrls: lesson.items.map(itemUrl) };
    } catch (error) {
      if (lessonId) {
        await supabase.from("lessons").delete().eq("id", lessonId).eq("owner_id", this.user.id);
      }
      await supabase
        .from("ingestion_runs")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown ingestion error", updated_at: nowIso() })
        .eq("id", id)
        .eq("owner_id", this.user.id);
      throw error;
    }
  }

  async getIngestionRun(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase.from("ingestion_runs").select("*").eq("id", id).eq("owner_id", this.user.id).maybeSingle();

    if (error) throw error;
    return data ? normalizeIngestionRun(data as SupabaseIngestionRunRow) : null;
  }
}

type MemoryState = {
  lessons: Lesson[];
  ingestionRuns: IngestionRun[];
};

const globalMemory = globalThis as typeof globalThis & { __englishReviewLessonMemoryStore?: MemoryState };

export function resetMemoryLessonStoreForTests() {
  globalMemory.__englishReviewLessonMemoryStore = { lessons: [], ingestionRuns: [] };
}

function memoryState() {
  globalMemory.__englishReviewLessonMemoryStore ??= { lessons: [], ingestionRuns: [] };
  return globalMemory.__englishReviewLessonMemoryStore;
}

function cloneLesson(lesson: Lesson): Lesson {
  return {
    ...lesson,
    items: lesson.items.map((item) => ({ ...item, examples: item.examples.map((example) => ({ ...example })) }))
  };
}

function cloneItem(item: StudyItem): StudyItem {
  return { ...item, lesson: item.lesson ? { ...item.lesson } : undefined, examples: item.examples.map((example) => ({ ...example })) };
}

export class MemoryLessonStore implements LessonStore {
  constructor(private readonly user: UserIdentity) {}

  async listLessons() {
    return memoryState()
      .lessons.filter((lesson) => lesson.owner_id === this.user.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map(cloneLesson);
  }

  async getLesson(id: string) {
    const lesson = memoryState().lessons.find((item) => item.id === id && item.owner_id === this.user.id);
    return lesson ? cloneLesson(lesson) : null;
  }

  async getItem(id: string) {
    for (const lesson of memoryState().lessons) {
      if (lesson.owner_id !== this.user.id) continue;
      const item = lesson.items.find((candidate) => candidate.id === id);
      if (item) {
        return cloneItem({
          ...item,
          lesson: {
            id: lesson.id,
            title: lesson.title,
            source_note: lesson.source_note,
            lesson_date: lesson.lesson_date
          }
        });
      }
    }
    return null;
  }

  private async listItems(status?: StudyStatus) {
    const lessons = await this.listLessons();
    const items = lessons.flatMap((lesson) =>
      lesson.items.map((item) => ({
        ...item,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          source_note: lesson.source_note,
          lesson_date: lesson.lesson_date
        }
      }))
    );
    return status ? items.filter((item) => item.status === status) : items;
  }

  async getReviewQueue(options: { confusingOnly?: boolean; limit?: number } = {}) {
    const items = await this.listItems(options.confusingOnly ? "confusing" : undefined);
    return scheduleReviewQueue(items, options.limit ?? 10).map(cloneItem);
  }

  async getDashboardStats() {
    const lessons = await this.listLessons();
    const items = await this.listItems();
    return calculateStats(lessons, items);
  }

  async markReviewed(id: string, status: Exclude<StudyStatus, "new">) {
    const located = this.findMutableItem(id);
    if (!located) throw new Error("Study item not found");
    const timestamp = nowIso();
    located.item.status = status;
    located.item.last_reviewed_at = timestamp;
    located.item.review_count += 1;
    located.item.updated_at = timestamp;
    located.lesson.updated_at = timestamp;
    return requireEntity(await this.getItem(id), "Study item not found");
  }

  async updateItemNotes(id: string, input: ItemNotesInput) {
    const located = this.findMutableItem(id);
    if (!located) throw new Error("Study item not found");
    const timestamp = nowIso();
    located.item.user_memo = input.userMemo || null;
    located.item.confusion_note = input.confusionNote || null;
    located.item.updated_at = timestamp;
    located.lesson.updated_at = timestamp;
    return requireEntity(await this.getItem(id), "Study item not found");
  }

  async createDraft(payload: LessonIngestionPayload) {
    const normalized = assertPayload(payload);
    const timestamp = nowIso();
    const run: IngestionRun = {
      id: randomUUID(),
      owner_id: this.user.id,
      raw_input: normalized.lesson.raw_input,
      normalized_payload: normalized,
      status: "drafted",
      error_message: null,
      created_at: timestamp,
      updated_at: timestamp
    };
    memoryState().ingestionRuns.unshift(run);
    return { ...run };
  }

  async reviseDraft(id: string, payload: LessonIngestionPayload) {
    const run = this.findMutableRun(id);
    if (!run) throw new Error("Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트는 수정할 수 없습니다.");
    const normalized = assertPayload(payload);
    run.raw_input = normalized.lesson.raw_input;
    run.normalized_payload = normalized;
    run.status = "revised";
    run.error_message = null;
    run.updated_at = nowIso();
    return { ...run };
  }

  async approveDraft(id: string, approvalText: string) {
    if (!isExplicitLessonSaveApproval(approvalText)) {
      throw new Error("명시적인 저장 승인 문구가 필요합니다.");
    }

    const run = this.findMutableRun(id);
    if (!run) throw new Error("Ingestion draft not found");
    if (run.status === "inserted") throw new Error("이미 저장된 드래프트입니다.");

    const timestamp = nowIso();
    const lessonId = randomUUID();
    const lesson: Lesson = {
      id: lessonId,
      owner_id: this.user.id,
      title: run.normalized_payload.lesson.title,
      raw_input: run.normalized_payload.lesson.raw_input,
      source_note: run.normalized_payload.lesson.source_note ?? null,
      lesson_date: run.normalized_payload.lesson.lesson_date ?? null,
      created_by: "llm",
      created_at: timestamp,
      updated_at: timestamp,
      items: run.normalized_payload.items.map((itemInput) => {
        const itemId = randomUUID();
        const item: StudyItem = {
          id: itemId,
          lesson_id: lessonId,
          owner_id: this.user.id,
          expression: itemInput.expression,
          meaning_ko: itemInput.meaning_ko,
          core_nuance: itemInput.core_nuance ?? null,
          structure_note: itemInput.structure_note ?? null,
          grammar_note: itemInput.grammar_note ?? null,
          user_memo: itemInput.user_memo ?? null,
          confusion_note: itemInput.confusion_note ?? null,
          status: "new",
          last_reviewed_at: null,
          review_count: 0,
          created_at: timestamp,
          updated_at: timestamp,
          examples: itemInput.examples.map((exampleInput, index) => ({
            id: randomUUID(),
            study_item_id: itemId,
            example_text: exampleInput.example_text,
            meaning_ko: exampleInput.meaning_ko ?? null,
            source: exampleInput.source ?? "llm",
            sort_order: index,
            created_at: timestamp
          }))
        };
        return item;
      })
    };

    memoryState().lessons.unshift(lesson);
    run.status = "inserted";
    run.error_message = null;
    run.updated_at = timestamp;
    return { lesson: cloneLesson(lesson), itemUrls: lesson.items.map(itemUrl) };
  }

  async getIngestionRun(id: string) {
    const run = memoryState().ingestionRuns.find((candidate) => candidate.id === id && candidate.owner_id === this.user.id);
    return run ? { ...run } : null;
  }

  private findMutableRun(id: string) {
    return memoryState().ingestionRuns.find((run) => run.id === id && run.owner_id === this.user.id) ?? null;
  }

  private findMutableItem(id: string) {
    for (const lesson of memoryState().lessons) {
      if (lesson.owner_id !== this.user.id) continue;
      const item = lesson.items.find((candidate) => candidate.id === id);
      if (item) return { lesson, item };
    }
    return null;
  }
}

function calculateStats(lessons: Lesson[], items: StudyItem[]): DashboardStats {
  return {
    total: items.length,
    newCount: items.filter((item) => item.status === "new").length,
    learningCount: items.filter((item) => item.status === "learning").length,
    memorizedCount: items.filter((item) => item.status === "memorized").length,
    confusingCount: items.filter((item) => item.status === "confusing").length,
    dueCount: scheduleReviewQueue(items, 10).length,
    lessonCount: lessons.length
  };
}

export function getLessonStore(user: UserIdentity): LessonStore {
  if (isE2EMemoryMode()) {
    return new MemoryLessonStore(user);
  }

  return new SupabaseLessonStore(user);
}

export function getAdminLessonStore(user: UserIdentity): LessonStore {
  if (isE2EMemoryMode()) {
    return new MemoryLessonStore(user);
  }

  return new SupabaseLessonStore(user, createServiceRoleSupabaseClient);
}
