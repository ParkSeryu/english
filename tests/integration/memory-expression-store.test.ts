import { beforeEach, describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type UserIdentity = { id: string; email?: string };
type ReviewResult = "known" | "unknown";
type QuestionStatus = "open" | "asked";

type ExpressionIngestionPayload = {
  day: { title: string; set_date: string; raw_input: string };
  expressions: Array<{ english_text: string; korean_text: string; grammar_point?: string; natural_note?: string; source_order?: number }>;
};

type ExpressionCard = {
  id: string;
  english_text: string;
  korean_text: string;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_result: ReviewResult | null;
};

type ExpressionDay = { id: string; owner_id: string; set_date: string; title: string; expressions: ExpressionCard[] };
type QuestionNote = { id: string; body: string; status: QuestionStatus; expression_id: string | null; day_id: string | null };
type IngestionRun = { id: string; owner_id: string; status: string };

type ApprovedExpressionDayResult = { day: ExpressionDay; expressionUrls: string[] };

type MemoryExpressionStoreInstance = {
  createDraft: (payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  reviseDraft: (id: string, payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  approveDraft: (id: string, approvalText: string) => Promise<ApprovedExpressionDayResult>;
  listExpressionDays: () => Promise<ExpressionDay[]>;
  getExpressionDay: (id: string) => Promise<ExpressionDay | null>;
  getExpression: (id: string) => Promise<ExpressionCard | null>;
  getMemorizeQueue: (options?: { limit?: number }) => Promise<ExpressionCard[]>;
  recordReviewResult: (id: string, result: ReviewResult) => Promise<ExpressionCard>;
  createQuestionNote: (input: { body: string; dayId?: string; expressionId?: string }) => Promise<QuestionNote>;
  listQuestionNotes: () => Promise<QuestionNote[]>;
  updateQuestionNoteStatus: (id: string, status: QuestionStatus) => Promise<QuestionNote>;
};

type StoreModule = {
  MemoryExpressionStore: new (user: UserIdentity) => MemoryExpressionStoreInstance;
  resetMemoryExpressionStoreForTests: () => void;
};

const userA = { id: "00000000-0000-4000-8000-0000000000aa", email: "a@example.com" };
const userB = { id: "00000000-0000-4000-8000-0000000000bb", email: "b@example.com" };

const payload: ExpressionIngestionPayload = {
  day: {
    title: "오늘의 영어표현",
    set_date: "20260427",
    raw_input: "오늘의 영어표현 (20260427)"
  },
  expressions: [
    {
      english_text: "The birth rate in Korea is decreasing.",
      korean_text: "한국의 출산율이 감소하고 있어요.",
      grammar_point: "decrease = 감소하다",
      source_order: 0
    },
    {
      english_text: "I try not to eat.",
      korean_text: "저는 먹지 않으려고 노력해요.",
      grammar_point: "try not to + 동사원형",
      source_order: 1
    }
  ]
};

describe("MemoryExpressionStore daily expression behavior", () => {
  beforeEach(async () => {
    const { resetMemoryExpressionStoreForTests } = await importModule<StoreModule>("@/lib/expression-store");
    resetMemoryExpressionStoreForTests();
  });

  it("drafts, revises, and only inserts expression days after explicit approval", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const draft = await store.createDraft(payload);

    expect(draft.status).toBe("drafted");
    expect(await store.listExpressionDays()).toEqual([]);
    await expect(store.approveDraft(draft.id, "좋네")).rejects.toThrow("명시적인 저장 승인");
    expect(await store.listExpressionDays()).toEqual([]);

    const revised = await store.reviseDraft(draft.id, {
      ...payload,
      expressions: [{ ...payload.expressions[0], natural_note: "원문 답은 바꾸지 말고 메모만 추가한다." }]
    });
    expect(revised.status).toBe("revised");

    const approved = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
    expect(approved.day).toMatchObject({ owner_id: userA.id, set_date: "2026-04-27" });
    expect(approved.day.expressions).toHaveLength(1);
    expect(approved.expressionUrls[0]).toMatch(/^\/expressions\//);
  });

  it("records known/unknown counters and prioritizes unknown-heavy queue items", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const { day } = await store.approveDraft((await store.createDraft(payload)).id, "저장해");

    const unknown = await store.recordReviewResult(day.expressions[1].id, "unknown");
    expect(unknown).toMatchObject({ unknown_count: 1, known_count: 0, review_count: 1, last_result: "unknown" });

    const known = await store.recordReviewResult(day.expressions[0].id, "known");
    expect(known).toMatchObject({ unknown_count: 0, known_count: 1, review_count: 1, last_result: "known" });

    const queue = await store.getMemorizeQueue();
    expect(queue[0].id).toBe(unknown.id);
  });

  it("keeps expression days, expressions, and question notes owner-scoped", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const storeA = new MemoryExpressionStore(userA);
    const { day } = await storeA.approveDraft((await storeA.createDraft(payload)).id, "저장해");
    const question = await storeA.createQuestionNote({ body: "decrease와 reduce 차이를 물어보기", dayId: day.id, expressionId: day.expressions[0].id });

    const storeB = new MemoryExpressionStore(userB);
    expect(await storeB.getExpressionDay(day.id)).toBeNull();
    expect(await storeB.getExpression(day.expressions[0].id)).toBeNull();
    expect(await storeB.listQuestionNotes()).toEqual([]);
    await expect(storeB.updateQuestionNoteStatus(question.id, "asked")).rejects.toThrow("Question note not found");
  });

  it("lists open questions before asked questions and can reopen them", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const asked = await store.createQuestionNote({ body: "이미 물어본 질문" });
    await store.updateQuestionNoteStatus(asked.id, "asked");
    const open = await store.createQuestionNote({ body: "수업 때 물어볼 질문" });

    expect((await store.listQuestionNotes()).map((note) => note.id)).toEqual([open.id, asked.id]);

    const reopened = await store.updateQuestionNoteStatus(asked.id, "open");
    expect(reopened.status).toBe("open");
    expect((await store.listQuestionNotes()).filter((note) => note.status === "open")).toHaveLength(2);
  });
});
