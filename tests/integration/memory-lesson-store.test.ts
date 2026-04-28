import { beforeEach, describe, expect, it } from "vitest";

import { MemoryLessonStore, resetMemoryLessonStoreForTests } from "@/lib/lesson-store";
import type { LessonIngestionPayload } from "@/lib/types";

const userA = { id: "00000000-0000-4000-8000-0000000000aa", email: "a@example.com" };
const userB = { id: "00000000-0000-4000-8000-0000000000bb", email: "b@example.com" };

const payload: LessonIngestionPayload = {
  lesson: {
    title: "have to / be used to",
    raw_input: "어제 have to랑 I am used to를 배웠어.",
    source_note: "학원 수업",
    lesson_date: "2026-04-27"
  },
  items: [
    {
      expression: "have to ~",
      meaning_ko: "~해야 한다 / ~할 필요가 있다",
      core_nuance: "의무나 필요성",
      structure_note: "have to + 동사원형",
      grammar_note: "3인칭 단수는 has to",
      examples: [{ example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm" }],
      confusion_note: "must와 헷갈림",
      user_memo: "선생님이 must보다 일상적이라고 함"
    },
    {
      expression: "I am used to ~",
      meaning_ko: "~에 익숙하다",
      core_nuance: "더 이상 낯설지 않은 상태",
      structure_note: "be used to + 명사 / 동명사",
      grammar_note: "to 뒤에는 동사원형이 오지 않는다",
      examples: [{ example_text: "I am used to waking up early.", meaning_ko: "나는 일찍 일어나는 것에 익숙하다.", source: "llm" }]
    }
  ]
};

describe("MemoryLessonStore integration behavior", () => {
  beforeEach(() => resetMemoryLessonStoreForTests());

  it("drafts, revises, approves, reviews, and edits notes without inserting before approval", async () => {
    const store = new MemoryLessonStore(userA);
    const draft = await store.createDraft(payload);

    expect(draft.status).toBe("drafted");
    expect(await store.listLessons()).toEqual([]);
    await expect(store.approveDraft(draft.id, "좋네")).rejects.toThrow("명시적인 저장 승인");
    expect(await store.listLessons()).toEqual([]);

    const revised = await store.reviseDraft(draft.id, {
      ...payload,
      items: [{ ...payload.items[0], examples: [{ example_text: "I have to go now.", meaning_ko: "나는 지금 가야 한다.", source: "llm" }] }]
    });
    expect(revised.status).toBe("revised");

    const approved = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
    expect(approved.lesson.items).toHaveLength(1);
    expect(approved.itemUrls[0]).toMatch(/^\/items\//);

    const item = approved.lesson.items[0];
    const confusing = await store.markReviewed(item.id, "confusing");
    expect(confusing.status).toBe("confusing");
    expect(confusing.review_count).toBe(1);

    const noted = await store.updateItemNotes(item.id, { userMemo: "내가 자주 쓰는 표현", confusionNote: "must와 비교" });
    expect(noted.user_memo).toBe("내가 자주 쓰는 표현");
    expect(noted.confusion_note).toBe("must와 비교");

    const queue = await store.getReviewQueue();
    expect(queue[0].id).toBe(item.id);
  });

  it("keeps lessons and study items owner-scoped", async () => {
    const storeA = new MemoryLessonStore(userA);
    const draft = await storeA.createDraft(payload);
    const approved = await storeA.approveDraft(draft.id, "저장해");
    const otherStore = new MemoryLessonStore(userB);

    expect(await otherStore.getLesson(approved.lesson.id)).toBeNull();
    expect(await otherStore.getItem(approved.lesson.items[0].id)).toBeNull();
    expect(await otherStore.listLessons()).toEqual([]);
    await expect(otherStore.updateItemNotes(approved.lesson.items[0].id, { userMemo: "hack", confusionNote: "hack" })).rejects.toThrow("Study item not found");
  });
});
