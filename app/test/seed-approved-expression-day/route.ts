import { NextResponse } from "next/server";

import { getExpressionStore } from "@/lib/lesson-store";
import { getE2EFakeUserId, isE2EMemoryMode } from "@/lib/test-mode";
import type { ExpressionIngestionPayload } from "@/lib/types";

const sampleExpressionDay: ExpressionIngestionPayload = {
  expression_day: {
    title: "오늘의 영어표현",
    raw_input: [
      "오늘의 영어표현 (20260427)",
      "The birth rate in Korea is decreasing. (한국의 출산율이 감소하고 있어요.)",
      "I try not to eat. (저는 먹지 않으려고 노력해요.)"
    ].join("\n"),
    source_note: "수업 표현",
    day_date: "20260427"
  },
  expressions: [
    {
      english: "The birth rate in Korea is decreasing.",
      korean_prompt: "한국의 출산율이 감소하고 있어요.",
      grammar_note: "is decreasing = 감소하고 있다"
    },
    {
      english: "I try not to eat.",
      korean_prompt: "저는 먹지 않으려고 노력해요.",
      grammar_note: "try not to + 동사원형"
    }
  ]
};

export async function POST() {
  if (!isE2EMemoryMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fakeUserId = getE2EFakeUserId();
  if (!fakeUserId) return NextResponse.json({ error: "Missing fake user" }, { status: 500 });

  const store = getExpressionStore({ id: fakeUserId, email: "e2e@example.com" });
  const draft = await store.createDraft(sampleExpressionDay);
  const result = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
  return NextResponse.json({ expressionDay: result.expressionDay, expressionUrls: result.expressionUrls });
}
