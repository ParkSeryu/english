import { beforeEach, describe, expect, it } from "vitest";

import { MemoryExpressionStore, resetMemoryExpressionStoreForTests } from "@/lib/lesson-store";
import type { ExpressionIngestionPayload } from "@/lib/types";

const userA = { id: "00000000-0000-4000-8000-0000000000aa", email: "a@example.com" };
const userB = { id: "00000000-0000-4000-8000-0000000000bb", email: "b@example.com" };

const payload: ExpressionIngestionPayload = {
  expression_day: { title: "have to / be used to", raw_input: "어제 have to랑 I am used to를 배웠어.", source_note: "학원 수업", day_date: "20260427" },
  expressions: [
    { english: "have to ~", korean_prompt: "~해야 한다 / ~할 필요가 있다", nuance_note: "의무나 필요성", structure_note: "have to + 동사원형", grammar_note: "3인칭 단수는 has to", examples: [{ example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm" }], user_memo: "선생님이 must보다 일상적이라고 함" },
    { english: "I am used to ~", korean_prompt: "~에 익숙하다", nuance_note: "더 이상 낯설지 않은 상태", structure_note: "be used to + 명사 / 동명사", grammar_note: "to 뒤에는 동사원형이 오지 않는다", examples: [{ example_text: "I am used to waking up early.", meaning_ko: "나는 일찍 일어나는 것에 익숙하다.", source: "llm" }] }
  ]
};

describe("MemoryExpressionStore integration behavior", () => {
  beforeEach(() => resetMemoryExpressionStoreForTests());

  it("drafts, revises, approves, reviews, memos, and questions without inserting before approval", async () => {
    const store = new MemoryExpressionStore(userA);
    const draft = await store.createDraft(payload);
    expect(draft.status).toBe("drafted");
    expect(await store.listExpressionDays()).toEqual([]);
    await expect(store.approveDraft(draft.id, "좋네")).rejects.toThrow("명시적인 저장 승인");

    const revised = await store.reviseDraft(draft.id, { ...payload, expressions: [{ ...payload.expressions[0], examples: [{ example_text: "I have to go now.", meaning_ko: "나는 지금 가야 한다.", source: "llm" }] }] });
    expect(revised.status).toBe("revised");

    const approved = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
    expect(approved.expressionDay.expressions).toHaveLength(1);
    expect(approved.expressionUrls[0]).toMatch(/^\/expressions\//);

    const expression = approved.expressionDay.expressions[0];
    const unknown = await store.recordReviewResult(expression.id, "unknown");
    expect(unknown.unknown_count).toBe(1);
    const known = await store.recordReviewResult(expression.id, "known");
    expect(known.known_count).toBe(1);

    const noted = await store.updateExpressionMemo(expression.id, { userMemo: "내가 자주 쓰는 표현" });
    expect(noted.user_memo).toBe("내가 자주 쓰는 표현");

    const question = await store.createQuestionNote({ questionText: "must와 have to 차이는?" });
    expect(question.status).toBe("open");
    expect((await store.updateQuestionNote(question.id, { status: "asked" })).status).toBe("asked");

    const queue = await store.getMemorizationQueue();
    expect(queue[0].id).toBe(expression.id);
  });

  it("keeps expression days, expressions, and questions owner-scoped", async () => {
    const storeA = new MemoryExpressionStore(userA);
    const draft = await storeA.createDraft(payload);
    const approved = await storeA.approveDraft(draft.id, "저장해");
    await storeA.createQuestionNote({ questionText: "owner only?" });
    const otherStore = new MemoryExpressionStore(userB);

    expect(await otherStore.getExpressionDay(approved.expressionDay.id)).toBeNull();
    expect(await otherStore.getExpression(approved.expressionDay.expressions[0].id)).toBeNull();
    expect(await otherStore.listExpressionDays()).toEqual([]);
    expect(await otherStore.listQuestionNotes()).toEqual([]);
    await expect(otherStore.updateExpressionMemo(approved.expressionDay.expressions[0].id, { userMemo: "hack" })).rejects.toThrow("Expression not found");
  });
});
