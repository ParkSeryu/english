import { describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type SafeParseResult = { success: boolean; data?: unknown; error?: { flatten: () => unknown } };
type SafeParseSchema = { safeParse: (input: unknown) => SafeParseResult };

type ValidationModule = {
  expressionIngestionPayloadSchema: SafeParseSchema;
  normalizeExpressionDayDate: (input: string) => string;
};

const validDailyExpressionPayload = {
  expression_day: {
    title: "오늘의 영어표현",
    day_date: "20260427",
    raw_input: "오늘의 영어표현 (20260427)\nThe birth rate in Korea is decreasing. (한국의 출산율이 감소하고 있어요.)"
  },
  expressions: [
    {
      english: "The birth rate in Korea is decreasing.",
      korean_prompt: "한국의 출산율이 감소하고 있어요.",
      grammar_note: "decrease = 감소하다",
      nuance_note: "원문 문장을 암기 답으로 유지한다."
    }
  ]
};

describe("daily expression ingestion validation", () => {
  it("accepts Korean-first daily expression payloads and normalizes compact dates", async () => {
    const { expressionIngestionPayloadSchema, normalizeExpressionDayDate } = await importModule<ValidationModule>("@/lib/validation");

    expect(normalizeExpressionDayDate("260427")).toBe("2026-04-27");
    expect(normalizeExpressionDayDate("20260427")).toBe("2026-04-27");
    expect(normalizeExpressionDayDate("2026-04-27")).toBe("2026-04-27");

    const parsed = expressionIngestionPayloadSchema.safeParse(validDailyExpressionPayload);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ expression_day: { day_date: "2026-04-27" } });
  });

  it("rejects payloads missing English, Korean, date, or expressions", async () => {
    const { expressionIngestionPayloadSchema } = await importModule<ValidationModule>("@/lib/validation");

    for (const payload of [
      { ...validDailyExpressionPayload, expression_day: { ...validDailyExpressionPayload.expression_day, day_date: "invalid" } },
      { ...validDailyExpressionPayload, expressions: [] },
      { ...validDailyExpressionPayload, expressions: [{ ...validDailyExpressionPayload.expressions[0], english: "" }] },
      { ...validDailyExpressionPayload, expressions: [{ ...validDailyExpressionPayload.expressions[0], korean_prompt: "" }] }
    ]) {
      expect(expressionIngestionPayloadSchema.safeParse(payload).success).toBe(false);
    }
  });
});
