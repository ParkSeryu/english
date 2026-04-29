import { beforeEach, describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type UserIdentity = { id: string; email?: string };
type ReviewResult = "known" | "unknown";
type QuestionStatus = "open" | "asked";

type ExpressionIngestionPayload = {
  expression_day: { title: string; day_date: string; raw_input: string };
  expressions: Array<{ english: string; korean_prompt: string; grammar_note?: string; nuance_note?: string; structure_note?: string }>;
};

type ExpressionCard = {
  id: string;
  english: string;
  korean_prompt: string;
  nuance_note: string | null;
  structure_note: string | null;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_result: ReviewResult | null;
  last_reviewed_at: string | null;
  due_at: string | null;
  interval_days: number;
};

type ExpressionDay = { id: string; owner_id: string; day_date: string; title: string; expressions: ExpressionCard[] };
type QuestionNote = { id: string; question_text: string; status: QuestionStatus };
type IngestionRun = { id: string; owner_id: string; status: string };

type ApprovedExpressionDayResult = { expressionDay: ExpressionDay; expressionUrls: string[] };

type MemoryExpressionStoreInstance = {
  createDraft: (payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  reviseDraft: (id: string, payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  approveDraft: (id: string, approvalText: string) => Promise<ApprovedExpressionDayResult>;
  listExpressionDays: () => Promise<ExpressionDay[]>;
  getExpressionDay: (id: string) => Promise<ExpressionDay | null>;
  getExpression: (id: string) => Promise<ExpressionCard | null>;
  getMemorizationQueue: (options?: { limit?: number }) => Promise<ExpressionCard[]>;
  recordReviewResult: (id: string, result: ReviewResult) => Promise<ExpressionCard>;
  updateExpressionMemo: (id: string, input: { userMemo: string }) => Promise<ExpressionCard>;
  createQuestionNote: (input: { questionText: string }) => Promise<QuestionNote>;
  listQuestionNotes: () => Promise<QuestionNote[]>;
  updateQuestionNote: (id: string, input: { status: QuestionStatus }) => Promise<QuestionNote>;
};

type StoreModule = {
  MemoryExpressionStore: new (user: UserIdentity) => MemoryExpressionStoreInstance;
  resetMemoryExpressionStoreForTests: () => void;
};

const userA = { id: "00000000-0000-4000-8000-0000000000aa", email: "a@example.com" };
const userB = { id: "00000000-0000-4000-8000-0000000000bb", email: "b@example.com" };

const payload: ExpressionIngestionPayload = {
  expression_day: {
    title: "오늘의 영어표현",
    day_date: "20260427",
    raw_input: "오늘의 영어표현 (20260427)"
  },
  expressions: [
    {
      english: "The birth rate in Korea is decreasing.",
      korean_prompt: "한국의 출산율이 감소하고 있어요.",
      grammar_note: "decrease = 감소하다"
    },
    {
      english: "I try not to eat.",
      korean_prompt: "저는 먹지 않으려고 노력해요.",
      grammar_note: "try not to + 동사원형"
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
      expressions: [{ ...payload.expressions[0], nuance_note: "원문 답은 바꾸지 말고 메모만 추가한다.", structure_note: "주어 + 동사" }]
    });
    expect(revised.status).toBe("revised");

    const approved = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
    expect(approved.expressionDay).toMatchObject({ owner_id: userA.id, day_date: "2026-04-27" });
    expect(approved.expressionDay.expressions).toHaveLength(1);
    expect(approved.expressionDay.expressions[0]).toMatchObject({ nuance_note: null, structure_note: null });
    expect(approved.expressionUrls[0]).toMatch(/^\/expressions\//);
  });

  it("records cumulative Anki-lite review counters and next due times", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const { expressionDay } = await store.approveDraft((await store.createDraft(payload)).id, "저장해");

    const unknown = await store.recordReviewResult(expressionDay.expressions[1].id, "unknown");
    expect(unknown).toMatchObject({ unknown_count: 1, known_count: 0, review_count: 1, last_result: "unknown", interval_days: 0 });
    expect(unknown.due_at).toBeTruthy();

    const repeatedUnknown = await store.recordReviewResult(expressionDay.expressions[1].id, "unknown");
    expect(repeatedUnknown).toMatchObject({ unknown_count: 2, known_count: 0, review_count: 2, last_result: "unknown", interval_days: 0 });

    const known = await store.recordReviewResult(expressionDay.expressions[0].id, "known");
    expect(known).toMatchObject({ unknown_count: 0, known_count: 1, review_count: 1, last_result: "known", interval_days: 1 });
    expect(known.due_at).toBeTruthy();

    const queue = await store.getMemorizationQueue();
    expect(queue.map((item) => item.id)).not.toContain(known.id);

    const switchedKnown = await store.recordReviewResult(expressionDay.expressions[1].id, "known");
    expect(switchedKnown).toMatchObject({ unknown_count: 2, known_count: 1, review_count: 3, last_result: "known", interval_days: 1 });
  });

  it("shares expression content while keeping progress, memos, and question notes per user", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const storeA = new MemoryExpressionStore(userA);
    const { expressionDay } = await storeA.approveDraft((await storeA.createDraft(payload)).id, "저장해");
    const expressionId = expressionDay.expressions[0].id;
    const question = await storeA.createQuestionNote({ questionText: "decrease와 reduce 차이를 물어보기" });

    await storeA.recordReviewResult(expressionId, "unknown");
    await storeA.updateExpressionMemo(expressionId, { userMemo: "A만 보는 메모" });

    const storeB = new MemoryExpressionStore(userB);
    const sharedDayForB = await storeB.getExpressionDay(expressionDay.id);
    expect(sharedDayForB).toMatchObject({ id: expressionDay.id, title: expressionDay.title });

    const expressionForB = await storeB.getExpression(expressionId);
    expect(expressionForB).toMatchObject({
      id: expressionId,
      english: expressionDay.expressions[0].english,
      unknown_count: 0,
      known_count: 0,
      review_count: 0,
      user_memo: null
    });

    await storeB.recordReviewResult(expressionId, "known");
    expect(await storeA.getExpression(expressionId)).toMatchObject({ unknown_count: 1, known_count: 0, user_memo: "A만 보는 메모" });
    expect(await storeB.getExpression(expressionId)).toMatchObject({ unknown_count: 0, known_count: 1, user_memo: null });

    expect(await storeB.listQuestionNotes()).toEqual([]);
    await expect(storeB.updateQuestionNote(question.id, { status: "asked" })).rejects.toThrow("Question note not found");
  });

  it("lists open questions before asked questions and can reopen them", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const asked = await store.createQuestionNote({ questionText: "이미 물어본 질문" });
    await store.updateQuestionNote(asked.id, { status: "asked" });
    const open = await store.createQuestionNote({ questionText: "수업 때 물어볼 질문" });

    expect((await store.listQuestionNotes()).map((note) => note.id)).toEqual([open.id, asked.id]);

    const reopened = await store.updateQuestionNote(asked.id, { status: "open" });
    expect(reopened.status).toBe("open");
    expect((await store.listQuestionNotes()).filter((note) => note.status === "open")).toHaveLength(2);
  });
});
