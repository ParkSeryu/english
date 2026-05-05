import { beforeEach, describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type UserIdentity = { id: string; email?: string };
type ReviewResult = "known" | "unknown";
type QuestionStatus = "open" | "asked" | "answered";

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
  grammar_note: string | null;
  user_memo: string | null;
  unknown_count: number;
  known_count: number;
  review_count: number;
  last_result: ReviewResult | null;
  last_reviewed_at: string | null;
  due_at: string | null;
  interval_days: number;
  is_memorization_enabled: boolean;
  can_delete: boolean;
};

type ExpressionDay = { id: string; owner_id: string; day_date: string; title: string; expressions: ExpressionCard[] };
type QuestionNote = { id: string; question_text: string; status: QuestionStatus; answer_note: string | null };
type IngestionRun = { id: string; owner_id: string; status: string };

type ApprovedExpressionDayResult = { expressionDay: ExpressionDay; expressionUrls: string[] };

type MemoryExpressionStoreInstance = {
  createDraft: (payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  reviseDraft: (id: string, payload: ExpressionIngestionPayload) => Promise<IngestionRun>;
  approveDraft: (id: string, approvalText: string) => Promise<ApprovedExpressionDayResult>;
  listExpressionDays: () => Promise<ExpressionDay[]>;
  getExpressionDay: (id: string) => Promise<ExpressionDay | null>;
  getExpression: (id: string) => Promise<ExpressionCard | null>;
  getDashboardStats: () => Promise<{ total: number }>;
  getMemorizationQueue: (options?: { limit?: number }) => Promise<ExpressionCard[]>;
  recordReviewResult: (id: string, result: ReviewResult) => Promise<ExpressionCard>;
  updateExpressionMemo: (id: string, input: { userMemo: string; isMemorizationEnabled: boolean }) => Promise<ExpressionCard>;
  createPersonalExpression: (input: { english: string; koreanPrompt: string; grammarNote?: string | null; userMemo?: string | null; isMemorizationEnabled: boolean; targetExpressionDayId?: string | null }) => Promise<ExpressionCard>;
  updatePersonalExpression: (id: string, input: { english: string; koreanPrompt: string; grammarNote?: string | null; userMemo?: string | null; isMemorizationEnabled: boolean }) => Promise<ExpressionCard>;
  deletePersonalExpression: (id: string) => Promise<void>;
  createQuestionNote: (input: { questionText: string; answerNote?: string; status?: QuestionStatus }) => Promise<QuestionNote>;
  listQuestionNotes: () => Promise<QuestionNote[]>;
  updateQuestionNote: (id: string, input: { questionText?: string; answerNote?: string; status?: QuestionStatus }) => Promise<QuestionNote>;
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
    expect(unknown).toMatchObject({ unknown_count: 1, known_count: 0, review_count: 1, last_result: "unknown", interval_days: 0, due_at: null });

    const repeatedUnknown = await store.recordReviewResult(expressionDay.expressions[1].id, "unknown");
    expect(repeatedUnknown).toMatchObject({ unknown_count: 2, known_count: 0, review_count: 2, last_result: "unknown", interval_days: 0, due_at: null });

    const known = await store.recordReviewResult(expressionDay.expressions[0].id, "known");
    expect(known).toMatchObject({ unknown_count: 0, known_count: 1, review_count: 1, last_result: "known", interval_days: 3 });
    expect(known.due_at).toBeTruthy();

    const queue = await store.getMemorizationQueue();
    expect(queue.map((item) => item.id)).not.toContain(known.id);

    const switchedKnown = await store.recordReviewResult(expressionDay.expressions[1].id, "known");
    expect(switchedKnown).toMatchObject({ unknown_count: 2, known_count: 1, review_count: 3, last_result: "known", interval_days: 1 });
  });

  it("promotes direct recalls but preserves the lapsed interval after repeated unknowns", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const { expressionDay } = await store.approveDraft((await store.createDraft(payload)).id, "저장해");
    const expressionId = expressionDay.expressions[0].id;

    expect(await store.recordReviewResult(expressionId, "known")).toMatchObject({ interval_days: 3, known_count: 1 });
    expect(await store.recordReviewResult(expressionId, "known")).toMatchObject({ interval_days: 7, known_count: 2 });
    expect(await store.recordReviewResult(expressionId, "known")).toMatchObject({ interval_days: 14, known_count: 3 });
    expect(await store.recordReviewResult(expressionId, "known")).toMatchObject({ interval_days: 30, known_count: 4 });

    expect(await store.recordReviewResult(expressionId, "unknown")).toMatchObject({ interval_days: 14, unknown_count: 1, due_at: null });
    expect(await store.recordReviewResult(expressionId, "unknown")).toMatchObject({ interval_days: 14, unknown_count: 2, due_at: null });
    expect(await store.recordReviewResult(expressionId, "known")).toMatchObject({ interval_days: 14, known_count: 5, last_result: "known" });
  });

  it("shares expression content while keeping progress, memos, and question notes per user", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const storeA = new MemoryExpressionStore(userA);
    const { expressionDay } = await storeA.approveDraft((await storeA.createDraft(payload)).id, "저장해");
    const expressionId = expressionDay.expressions[0].id;
    const question = await storeA.createQuestionNote({ questionText: "decrease와 reduce 차이를 물어보기" });

    await storeA.recordReviewResult(expressionId, "unknown");
    await storeA.updateExpressionMemo(expressionId, { userMemo: "A만 보는 메모", isMemorizationEnabled: true });

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


  it("keeps user-added expressions private and honors per-user memorize inclusion", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const topicOwnerStore = new MemoryExpressionStore(userB);
    const storeA = new MemoryExpressionStore(userA);
    const storeB = new MemoryExpressionStore(userB);
    const approved = await topicOwnerStore.approveDraft((await topicOwnerStore.createDraft(payload)).id, "이대로 앱에 넣어줘");

    const privateExpression = await storeA.createPersonalExpression({
      targetExpressionDayId: approved.expressionDay.id,
      english: "I need to sleep on it.",
      koreanPrompt: "좀 더 생각해 봐야겠어요.",
      grammarNote: "sleep on it = 하룻밤 생각해보다",
      userMemo: "A가 직접 추가",
      isMemorizationEnabled: false
    });

    expect(privateExpression).toMatchObject({
      english: "I need to sleep on it.",
      user_memo: "A가 직접 추가",
      is_memorization_enabled: false
    });
    expect((await storeA.listExpressionDays()).flatMap((day) => day.expressions).map((expression) => expression.id)).toContain(privateExpression.id);
    expect(await storeB.getExpression(privateExpression.id)).toBeNull();
    expect((await storeB.listExpressionDays()).flatMap((day) => day.expressions).map((expression) => expression.id)).not.toContain(privateExpression.id);
    expect((await storeA.getMemorizationQueue()).map((expression) => expression.id)).not.toContain(privateExpression.id);
    expect(await storeA.getDashboardStats()).toMatchObject({ total: approved.expressionDay.expressions.length });

    await storeA.updateExpressionMemo(privateExpression.id, { userMemo: "암기에 다시 포함", isMemorizationEnabled: true });
    expect((await storeA.getMemorizationQueue()).map((expression) => expression.id)).toContain(privateExpression.id);
    expect(await storeA.getDashboardStats()).toMatchObject({ total: approved.expressionDay.expressions.length + 1 });
  });

  it("rejects personal expression creation without a selected expression day", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const storeA = new MemoryExpressionStore(userA);

    await expect(
      storeA.createPersonalExpression({
        english: "I need to sleep on it.",
        koreanPrompt: "좀 더 생각해 봐야겠어요.",
        isMemorizationEnabled: true
      })
    ).rejects.toThrow("학습 토픽을 선택해 주세요");
    expect((await storeA.listExpressionDays()).map((day) => day.title)).not.toContain("내가 추가한 표현");
  });

  it("adds user expressions to the selected expression day when a target day is provided", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const topicOwnerStore = new MemoryExpressionStore(userB);
    const learnerStore = new MemoryExpressionStore(userA);
    const draft = await topicOwnerStore.createDraft(payload);
    const approved = await topicOwnerStore.approveDraft(draft.id, "이대로 앱에 넣어줘");

    const addedExpression = await learnerStore.createPersonalExpression({
      targetExpressionDayId: approved.expressionDay.id,
      english: "Coffee is not helping.",
      koreanPrompt: "커피가 도움이 안 돼요.",
      grammarNote: "help = 도움이 되다",
      userMemo: "수업 토픽에 추가",
      isMemorizationEnabled: true
    });

    const targetDay = await learnerStore.getExpressionDay(approved.expressionDay.id);
    expect(targetDay?.expressions.map((expression) => expression.id)).toContain(addedExpression.id);
    expect((await learnerStore.listExpressionDays()).map((day) => day.title)).not.toContain("내가 추가한 표현");
    expect((await topicOwnerStore.getExpressionDay(approved.expressionDay.id))?.expressions.map((expression) => expression.id)).not.toContain(addedExpression.id);
  });

  it("updates only directly added expressions including memorize inclusion", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const topicOwnerStore = new MemoryExpressionStore(userB);
    const learnerStore = new MemoryExpressionStore(userA);
    const approved = await topicOwnerStore.approveDraft((await topicOwnerStore.createDraft(payload)).id, "이대로 앱에 넣어줘");
    const sharedExpressionId = approved.expressionDay.expressions[0].id;
    const addedExpression = await learnerStore.createPersonalExpression({
      targetExpressionDayId: approved.expressionDay.id,
      english: "Coffee is not helping.",
      koreanPrompt: "커피가 도움이 안 돼요.",
      grammarNote: "help = 도움이 되다",
      userMemo: "수업 토픽에 추가",
      isMemorizationEnabled: true
    });

    const updated = await learnerStore.updatePersonalExpression(addedExpression.id, {
      english: "Coffee still is not helping.",
      koreanPrompt: "커피가 여전히 도움이 안 돼요.",
      grammarNote: "still = 여전히",
      userMemo: "내가 고친 표현",
      isMemorizationEnabled: false
    });

    expect(updated).toMatchObject({
      english: "Coffee still is not helping.",
      korean_prompt: "커피가 여전히 도움이 안 돼요.",
      grammar_note: "still = 여전히",
      user_memo: "내가 고친 표현",
      is_memorization_enabled: false,
      can_delete: true
    });
    expect((await learnerStore.getMemorizationQueue()).map((expression) => expression.id)).not.toContain(addedExpression.id);
    await expect(learnerStore.updatePersonalExpression(sharedExpressionId, {
      english: "Nope",
      koreanPrompt: "안 됨",
      isMemorizationEnabled: true
    })).rejects.toThrow("직접 추가한 표현만 수정할 수 있습니다");
  });

  it("deletes only expressions created by the current user", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const topicOwnerStore = new MemoryExpressionStore(userB);
    const learnerStore = new MemoryExpressionStore(userA);
    const approved = await topicOwnerStore.approveDraft((await topicOwnerStore.createDraft(payload)).id, "이대로 앱에 넣어줘");
    const sharedExpressionId = approved.expressionDay.expressions[0].id;
    const addedExpression = await learnerStore.createPersonalExpression({
      targetExpressionDayId: approved.expressionDay.id,
      english: "Coffee is not helping.",
      koreanPrompt: "커피가 도움이 안 돼요.",
      isMemorizationEnabled: true
    });

    expect(await learnerStore.getExpression(addedExpression.id)).toMatchObject({ can_delete: true });
    expect(await learnerStore.getExpression(sharedExpressionId)).toMatchObject({ can_delete: false });
    await expect(learnerStore.deletePersonalExpression(sharedExpressionId)).rejects.toThrow("직접 추가한 표현만 삭제할 수 있습니다");

    await learnerStore.deletePersonalExpression(addedExpression.id);
    expect(await learnerStore.getExpression(addedExpression.id)).toBeNull();
    expect((await learnerStore.getExpressionDay(approved.expressionDay.id))?.expressions.map((expression) => expression.id)).not.toContain(addedExpression.id);
    expect(await topicOwnerStore.getExpression(sharedExpressionId)).not.toBeNull();
  });

  it("lists open questions before asked and answered questions, and edits received answers", async () => {
    const { MemoryExpressionStore } = await importModule<StoreModule>("@/lib/expression-store");
    const store = new MemoryExpressionStore(userA);
    const asked = await store.createQuestionNote({ questionText: "이미 물어본 질문" });
    await store.updateQuestionNote(asked.id, { status: "asked" });
    const answered = await store.createQuestionNote({ questionText: "답변 받은 질문", answerNote: "초기 답변" });
    const open = await store.createQuestionNote({ questionText: "수업 때 물어볼 질문" });

    expect(answered.status).toBe("answered");
    expect((await store.listQuestionNotes()).map((note) => note.id)).toEqual([open.id, asked.id, answered.id]);

    const updated = await store.updateQuestionNote(answered.id, {
      questionText: "수정한 질문",
      answerNote: "수업 답변을 추가로 정리",
      status: "answered"
    });
    expect(updated).toMatchObject({ question_text: "수정한 질문", answer_note: "수업 답변을 추가로 정리", status: "answered" });

    const reopened = await store.updateQuestionNote(asked.id, { status: "open" });
    expect(reopened.status).toBe("open");
    expect((await store.listQuestionNotes()).filter((note) => note.status === "open")).toHaveLength(2);
  });
});
