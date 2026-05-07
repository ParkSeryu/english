import type { ExpressionStore } from "@/lib/lesson-store";
import { QUESTION_NOTE_STATUSES, type QuestionNoteInput, type QuestionNoteStatus } from "@/lib/types";

export async function createQuestionNote(store: ExpressionStore, input: QuestionNoteInput) {
  await store.createQuestionNote(input);
}

export async function updateQuestionStatus(store: ExpressionStore, questionId: string, status: QuestionNoteStatus) {
  if (!QUESTION_NOTE_STATUSES.includes(status)) throw new Error("질문 상태가 올바르지 않습니다.");
  await store.updateQuestionNote(questionId, { status });
}

export async function updateQuestionNote(store: ExpressionStore, questionId: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }) {
  await store.updateQuestionNote(questionId, input);
}
