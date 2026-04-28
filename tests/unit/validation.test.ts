import { describe, expect, it } from "vitest";

import { isExplicitLessonSaveApproval } from "@/lib/ingestion/approval";
import { expressionIngestionPayloadSchema, normalizeExpressionDayDate } from "@/lib/validation";

const validPayload = {
  expression_day: { title: "have to / be used to", raw_input: "어제 have to랑 I am used to를 배웠어.", source_note: "학원 수업", day_date: "260427" },
  expressions: [
    {
      english: "have to ~",
      korean_prompt: "~해야 한다 / ~할 필요가 있다",
      nuance_note: "의무나 필요성",
      structure_note: "have to + 동사원형",
      grammar_note: "3인칭 단수는 has to",
      examples: [{ example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm" }],
      user_memo: "선생님이 자주 쓴다고 함"
    }
  ]
};

describe("expressionIngestionPayloadSchema", () => {
  it("accepts a complete daily expression payload and normalizes compact dates", () => {
    const result = expressionIngestionPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expression_day.day_date).toBe("2026-04-27");
  });

  it.each([["260427", "2026-04-27"], ["20260427", "2026-04-27"], ["2026-04-27", "2026-04-27"]])("normalizes %s", (input, output) => {
    expect(normalizeExpressionDayDate(input)).toBe(output);
  });

  it("rejects missing required expression fields", () => {
    const result = expressionIngestionPayloadSchema.safeParse({ expression_day: { title: "bad", raw_input: "bad" }, expressions: [{ english: "", korean_prompt: "" }] });
    expect(result.success).toBe(false);
  });

  it("requires at least one expression", () => {
    expect(expressionIngestionPayloadSchema.safeParse({ expression_day: validPayload.expression_day, expressions: [] }).success).toBe(false);
  });
});

describe("isExplicitLessonSaveApproval", () => {
  it.each(["저장해", "앱에 넣어줘", "이대로 추가해", "이대로 앱에 넣어줘", "save this", "add to app"])("accepts explicit approval: %s", (text) => {
    expect(isExplicitLessonSaveApproval(text)).toBe(true);
  });
  it.each(["좋네", "괜찮아 보임", "예문 좀 더 쉽게 바꿔줘", "아직 저장하지마"])("rejects non-approval: %s", (text) => {
    expect(isExplicitLessonSaveApproval(text)).toBe(false);
  });
});
