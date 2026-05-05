import { z } from "zod";

import { QUESTION_NOTE_STATUSES } from "@/lib/types";

const nonBlankText = z.string().trim().min(1, "필수 항목입니다");
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

export function normalizeExpressionDayDate(input: string | null | undefined) {
  const value = String(input ?? "").trim();
  if (!value) return null;

  const compact = value.replaceAll("-", "");
  const expanded = compact.length === 6 ? `20${compact}` : compact;
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(expanded);
  if (!match) throw new Error("날짜는 YYMMDD, YYYYMMDD, YYYY-MM-DD 형식이어야 합니다");

  const [, year, month, day] = match;
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== normalized) {
    throw new Error("존재하지 않는 날짜입니다");
  }
  return normalized;
}

const dateText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value, ctx) => {
    try {
      return normalizeExpressionDayDate(value);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "날짜 형식이 올바르지 않습니다" });
      return z.NEVER;
    }
  });

export const expressionIngestionPayloadSchema = z.object({
  expression_day: z.object({
    title: nonBlankText.max(200, "제목은 200자 이내로 입력해 주세요"),
    raw_input: nonBlankText.max(10_000, "원본 메모는 10,000자 이내로 줄여 주세요"),
    source_note: optionalText(500),
    day_date: dateText
  }),
  expressions: z
    .array(
      z.object({
        english: nonBlankText.max(500, "영어 표현은 500자 이내로 입력해 주세요"),
        korean_prompt: nonBlankText.max(1_000, "한국어 암기 프롬프트는 1,000자 이내로 입력해 주세요"),
        nuance_note: optionalText(2_000),
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
          .max(12, "표현 하나의 예문은 12개 이하로 유지해 주세요")
          .optional()
          .default([]),
        user_memo: optionalText(2_000)
      })
    )
    .min(1, "암기 표현이 하나 이상 필요합니다")
    .max(30, "한 번에 저장할 표현은 30개 이하로 줄여 주세요")
});

export const cardMemoSchema = z.object({
  userMemo: z.string().trim().max(2_000, "내 메모는 2,000자 이내로 입력해 주세요"),
  isMemorizationEnabled: z.boolean().default(false)
});

export const personalExpressionSchema = z.object({
  english: nonBlankText.max(500, "영어 표현은 500자 이내로 입력해 주세요"),
  koreanPrompt: nonBlankText.max(1_000, "한국어 뜻/프롬프트는 1,000자 이내로 입력해 주세요"),
  grammarNote: optionalText(3_000),
  userMemo: optionalText(2_000),
  isMemorizationEnabled: z.boolean().default(false),
  targetExpressionDayId: z.string().uuid("학습 토픽 정보가 올바르지 않습니다").optional().nullable()
});

export const personalExpressionUpdateSchema = personalExpressionSchema.omit({ targetExpressionDayId: true });

export const questionNoteSchema = z.object({
  questionText: nonBlankText.max(1_000, "질문은 1,000자 이내로 입력해 주세요"),
  answerNote: z.string().trim().max(3_000, "답변 메모는 3,000자 이내로 입력해 주세요").optional().default("")
});

export const questionNoteUpdateSchema = questionNoteSchema.extend({
  status: z.enum(QUESTION_NOTE_STATUSES)
});

export function parseExpressionIngestionPayload(input: unknown) {
  return expressionIngestionPayloadSchema.safeParse(input);
}

export function parseCardMemoFormData(formData: FormData) {
  return cardMemoSchema.safeParse({
    userMemo: String(formData.get("userMemo") ?? "").trim(),
    isMemorizationEnabled: formData.get("isMemorizationEnabled") === "on"
  });
}

export function parsePersonalExpressionFormData(formData: FormData) {
  return personalExpressionSchema.safeParse({
    english: String(formData.get("english") ?? "").trim(),
    koreanPrompt: String(formData.get("koreanPrompt") ?? "").trim(),
    grammarNote: String(formData.get("grammarNote") ?? "").trim(),
    userMemo: String(formData.get("userMemo") ?? "").trim(),
    isMemorizationEnabled: formData.get("isMemorizationEnabled") === "on",
    targetExpressionDayId: String(formData.get("targetExpressionDayId") ?? "").trim() || null
  });
}

export function parsePersonalExpressionUpdateFormData(formData: FormData) {
  return personalExpressionUpdateSchema.safeParse({
    english: String(formData.get("english") ?? "").trim(),
    koreanPrompt: String(formData.get("koreanPrompt") ?? "").trim(),
    grammarNote: String(formData.get("grammarNote") ?? "").trim(),
    userMemo: String(formData.get("userMemo") ?? "").trim(),
    isMemorizationEnabled: formData.get("isMemorizationEnabled") === "on"
  });
}

export function parseQuestionNoteFormData(formData: FormData) {
  return questionNoteSchema.safeParse({
    questionText: String(formData.get("questionText") ?? "").trim(),
    answerNote: String(formData.get("answerNote") ?? "").trim()
  });
}

export function parseQuestionNoteUpdateFormData(formData: FormData) {
  return questionNoteUpdateSchema.safeParse({
    questionText: String(formData.get("questionText") ?? "").trim(),
    answerNote: String(formData.get("answerNote") ?? "").trim(),
    status: String(formData.get("status") ?? "")
  });
}

export function flattenZodErrors(error: z.ZodError) {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors) as Array<[string, string[] | undefined]>) {
    if (messages?.length) fieldErrors[field] = messages;
  }

  if (flattened.formErrors.length) fieldErrors.form = flattened.formErrors;
  return fieldErrors;
}

// Compatibility exports for existing ingestion callers/tests while routes migrate names.
export const lessonIngestionPayloadSchema = expressionIngestionPayloadSchema;
export const itemNotesSchema = cardMemoSchema;
export const studyStatusSchema = z.enum(["known", "unknown"]);
export function parseLessonIngestionPayload(input: unknown) {
  return parseExpressionIngestionPayload(input);
}
export function parseItemNotesFormData(formData: FormData) {
  return parseCardMemoFormData(formData);
}
