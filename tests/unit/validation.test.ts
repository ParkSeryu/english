import { describe, expect, it } from "vitest";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { lessonIngestionPayloadSchema } from "@/lib/validation";

const validPayload = {
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
      confusion_note: "must와 비슷하지만 더 일상적",
      user_memo: "선생님이 자주 쓴다고 함"
    }
  ]
};

describe("lessonIngestionPayloadSchema", () => {
  it("accepts a complete LLM lesson payload", () => {
    const result = lessonIngestionPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects missing required study item fields", () => {
    const result = lessonIngestionPayloadSchema.safeParse({
      lesson: { title: "bad", raw_input: "bad" },
      items: [{ expression: "", meaning_ko: "", examples: [] }]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const flattened = result.error.flatten();
      expect(flattened.formErrors).toEqual([]);
      expect(JSON.stringify(flattened.fieldErrors)).toContain("필수 항목입니다");
    }
  });

  it("requires at least one study item", () => {
    const result = lessonIngestionPayloadSchema.safeParse({ lesson: validPayload.lesson, items: [] });
    expect(result.success).toBe(false);
  });
});

describe("isExplicitLessonSaveApproval", () => {
  it.each(["저장해", "앱에 넣어줘", "이대로 추가해", "이대로 앱에 넣어줘", "save this", "add to app"])("accepts explicit approval: %s", (text) => {
    expect(isExplicitLessonSaveApproval(text)).toBe(true);
  });

  it.each(["좋네", "괜찮아 보임", "예문 좀 더 쉽게 바꿔줘", "have to 설명을 더 추가해줘", "I am used to는 과거에 익숙해졌다는 느낌 아닌가?", "아직 저장하지마"])(
    "rejects non-approval or revision text: %s",
    (text) => {
      expect(isExplicitLessonSaveApproval(text)).toBe(false);
    }
  );
});
