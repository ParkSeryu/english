import { z } from "zod";

import { REVIEW_MODES, STUDY_STATUSES } from "@/lib/types";

const nonBlankText = z.string().trim().min(1, "필수 항목입니다");
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const dateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다")
  .optional()
  .nullable()
  .transform((value) => value || null);

export const studyStatusSchema = z.enum(STUDY_STATUSES);
export const reviewModeSchema = z.enum(REVIEW_MODES);

export const lessonIngestionPayloadSchema = z.object({
  lesson: z.object({
    title: nonBlankText.max(200, "레슨 제목은 200자 이내로 입력해 주세요"),
    raw_input: nonBlankText.max(10_000, "원본 수업 메모는 10,000자 이내로 줄여 주세요"),
    source_note: optionalText(500),
    lesson_date: dateText
  }),
  items: z
    .array(
      z.object({
        expression: nonBlankText.max(500, "표현은 500자 이내로 입력해 주세요"),
        meaning_ko: nonBlankText.max(1_000, "한국어 뜻은 1,000자 이내로 입력해 주세요"),
        core_nuance: optionalText(2_000),
        structure_note: optionalText(2_000),
        grammar_note: optionalText(3_000),
        examples: z
          .array(
            z.object({
              example_text: nonBlankText.max(1_000, "예문은 1,000자 이내로 입력해 주세요"),
              meaning_ko: optionalText(1_000),
              source: z.enum(["llm", "user", "class"]).optional().default("llm")
            })
          )
          .min(1, "표현마다 예문이 하나 이상 필요합니다")
          .max(12, "표현 하나의 예문은 12개 이하로 유지해 주세요"),
        confusion_note: optionalText(2_000),
        user_memo: optionalText(2_000)
      })
    )
    .min(1, "학습 표현이 하나 이상 필요합니다")
    .max(30, "한 번에 저장할 표현은 30개 이하로 줄여 주세요")
});

export const itemNotesSchema = z.object({
  userMemo: z.string().trim().max(2_000, "내 메모는 2,000자 이내로 입력해 주세요"),
  confusionNote: z.string().trim().max(2_000, "헷갈린 점은 2,000자 이내로 입력해 주세요")
});

export function parseLessonIngestionPayload(input: unknown) {
  return lessonIngestionPayloadSchema.safeParse(input);
}

export function parseItemNotesFormData(formData: FormData) {
  return itemNotesSchema.safeParse({
    userMemo: String(formData.get("userMemo") ?? "").trim(),
    confusionNote: String(formData.get("confusionNote") ?? "").trim()
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
