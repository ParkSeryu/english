import { describe, expect, it, vi } from "vitest";

import type { ExpressionStore } from "@/lib/lesson-store";
import { createQuestionNote, updateQuestionNote, updateQuestionStatus } from "@/lib/use-cases/questions";

function storeStub(overrides: Record<string, unknown>): ExpressionStore {
  return overrides as unknown as ExpressionStore;
}

describe("question use cases", () => {
  it("creates a question note through the store", async () => {
    const createQuestionNoteStore = vi.fn(async () => ({ id: "question-1" }));
    const store = storeStub({ createQuestionNote: createQuestionNoteStore });
    const input = { questionText: "무슨 차이야?" };

    await createQuestionNote(store, input);
    expect(createQuestionNoteStore).toHaveBeenCalledWith(input);
  });

  it("validates status before updating a question", async () => {
    const updateQuestionNoteStore = vi.fn(async () => ({ id: "question-1" }));
    const store = storeStub({ updateQuestionNote: updateQuestionNoteStore });

    await expect(updateQuestionStatus(store, "question-1", "invalid" as "open")).rejects.toThrow("질문 상태가 올바르지 않습니다.");
    expect(updateQuestionNoteStore).not.toHaveBeenCalled();
  });

  it("updates question note content through the store", async () => {
    const updateQuestionNoteStore = vi.fn(async () => ({ id: "question-1" }));
    const store = storeStub({ updateQuestionNote: updateQuestionNoteStore });
    const input = { questionText: "수정한 질문", answerNote: "답변", status: "answered" as const };

    await updateQuestionNote(store, "question-1", input);
    expect(updateQuestionNoteStore).toHaveBeenCalledWith("question-1", input);
  });
});
