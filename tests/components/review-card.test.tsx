import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StudyItem } from "@/lib/types";

vi.mock("@/app/actions", () => ({
  markItemStatusAction: vi.fn(async () => undefined)
}));

import { ReviewCard } from "@/components/ReviewCard";

const item: StudyItem = {
  id: "item-1",
  lesson_id: "lesson-1",
  owner_id: "user-a",
  expression: "have to ~",
  meaning_ko: "~해야 한다 / ~할 필요가 있다",
  core_nuance: "의무나 필요성을 일상적으로 표현한다.",
  structure_note: "have to + 동사원형",
  grammar_note: "3인칭 단수는 has to",
  user_memo: "선생님이 must보다 일상적이라고 함",
  confusion_note: "must와 헷갈림",
  status: "new",
  last_reviewed_at: null,
  review_count: 0,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
  examples: [
    {
      id: "example-1",
      study_item_id: "item-1",
      example_text: "I have to study English.",
      meaning_ko: "나는 영어를 공부해야 한다.",
      source: "llm",
      sort_order: 0,
      created_at: "2026-04-28T00:00:00.000Z"
    }
  ]
};

describe("ReviewCard", () => {
  it("hides answer details before reveal and then shows mark controls", async () => {
    const user = userEvent.setup();
    render(<ReviewCard item={item} />);

    expect(screen.getByText((content) => content.includes(item.meaning_ko))).toBeInTheDocument();
    expect(screen.queryByText(item.expression)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /정답 보기/ }));

    expect(screen.getByText(item.expression)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /암기했어요/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /아직 헷갈려요/ })).toBeInTheDocument();
  });
});
