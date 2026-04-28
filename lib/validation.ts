import { z } from "zod";

const nonBlankText = z.string().trim().min(1, "필수 항목입니다");

export const cardInputSchema = z.object({
  englishText: nonBlankText.max(2_000, "영어 문장은 2,000자 이내로 입력해 주세요"),
  koreanMeaning: nonBlankText.max(2_000, "한국어 뜻은 2,000자 이내로 입력해 주세요"),
  grammarNote: nonBlankText.max(4_000, "문법/이론 메모는 4,000자 이내로 입력해 주세요"),
  examples: z
    .array(nonBlankText.max(2_000, "예문은 각각 2,000자 이내로 입력해 주세요"))
    .min(1, "예문을 하나 이상 추가해 주세요")
    .max(12, "MVP 복습에 맞게 예문 수를 줄여 주세요")
});

export function parseCardFormData(formData: FormData) {
  const examples = formData
    .getAll("examples")
    .map((value) => String(value).trim())
    .filter(Boolean);

  return cardInputSchema.safeParse({
    englishText: String(formData.get("englishText") ?? "").trim(),
    koreanMeaning: String(formData.get("koreanMeaning") ?? "").trim(),
    grammarNote: String(formData.get("grammarNote") ?? "").trim(),
    examples
  });
}

export function flattenZodErrors(error: z.ZodError) {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors) as Array<[string, string[] | undefined]>) {
    if (messages?.length) {
      fieldErrors[field] = messages;
    }
  }

  if (flattened.formErrors.length) {
    fieldErrors.form = flattened.formErrors;
  }

  return fieldErrors;
}
