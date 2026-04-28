import { describe, expect, it } from "vitest";

import { cardInputSchema } from "@/lib/validation";

describe("cardInputSchema", () => {
  it("accepts required card fields and one example", () => {
    const result = cardInputSchema.safeParse({
      englishText: "Could you elaborate on that?",
      koreanMeaning: "그 부분을 좀 더 자세히 설명해 주실 수 있나요?",
      grammarNote: "Could you + verb is a polite request pattern.",
      examples: ["Could you elaborate on your answer?"]
    });

    expect(result.success).toBe(true);
  });

  it("rejects blank required fields", () => {
    const result = cardInputSchema.safeParse({ englishText: "", koreanMeaning: "", grammarNote: "", examples: [""] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        englishText: ["필수 항목입니다"],
        koreanMeaning: ["필수 항목입니다"],
        grammarNote: ["필수 항목입니다"],
        examples: ["필수 항목입니다"]
      });
    }
  });

  it("requires at least one nonblank example", () => {
    const result = cardInputSchema.safeParse({
      englishText: "I am into reading.",
      koreanMeaning: "나는 독서에 빠져 있어.",
      grammarNote: "be into + noun/gerund",
      examples: []
    });

    expect(result.success).toBe(false);
  });
});
