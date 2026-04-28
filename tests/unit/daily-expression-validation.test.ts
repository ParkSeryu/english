import { describe, expect, it } from "vitest";

async function importModule<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

type SafeParseResult = { success: boolean; data?: unknown; error?: { flatten: () => unknown } };
type SafeParseSchema = { safeParse: (input: unknown) => SafeParseResult };

type ValidationModule = {
  expressionIngestionPayloadSchema: SafeParseSchema;
  normalizeExpressionDate: (input: string) => string;
};

const validDailyExpressionPayload = {
  day: {
    title: "오늘의 영어표현",
    set_date: "20260427",
    raw_input: "오늘의 영어표현 (20260427)\nThe birth rate in Korea is decreasing. (한국의 출산율이 감소하고 있어요.)"
  },
  expressions: [
    {
      english_text: "The birth rate in Korea is decreasing.",
      korean_text: "한국의 출산율이 감소하고 있어요.",
      grammar_point: "decrease = 감소하다",
      natural_note: "원문 문장을 암기 답으로 유지한다.",
      source_order: 0
    }
  ]
};

describe("daily expression ingestion validation", () => {
  it("accepts Korean-first daily expression payloads and normalizes compact dates", async () => {
    const { expressionIngestionPayloadSchema, normalizeExpressionDate } = await importModule<ValidationModule>("@/lib/validation");

    expect(normalizeExpressionDate("260427")).toBe("2026-04-27");
    expect(normalizeExpressionDate("20260427")).toBe("2026-04-27");
    expect(normalizeExpressionDate("2026-04-27")).toBe("2026-04-27");

    const parsed = expressionIngestionPayloadSchema.safeParse(validDailyExpressionPayload);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ day: { set_date: "2026-04-27" } });
  });

  it("rejects payloads missing English, Korean, date, or expressions", async () => {
    const { expressionIngestionPayloadSchema } = await importModule<ValidationModule>("@/lib/validation");

    for (const payload of [
      { ...validDailyExpressionPayload, day: { ...validDailyExpressionPayload.day, set_date: "" } },
      { ...validDailyExpressionPayload, expressions: [] },
      { ...validDailyExpressionPayload, expressions: [{ ...validDailyExpressionPayload.expressions[0], english_text: "" }] },
      { ...validDailyExpressionPayload, expressions: [{ ...validDailyExpressionPayload.expressions[0], korean_text: "" }] }
    ]) {
      expect(expressionIngestionPayloadSchema.safeParse(payload).success).toBe(false);
    }
  });
});
