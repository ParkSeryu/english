import { NextResponse } from "next/server";

import { getExpressionStore } from "@/lib/lesson-store";
import { getE2EFakeUserId, isE2EMemoryMode } from "@/lib/test-mode";
import type { ExpressionIngestionPayload } from "@/lib/types";

const sampleExpressionDay: ExpressionIngestionPayload = {
  expression_day: {
    title: "have to / be used to",
    raw_input: "어제 have to랑 I am used to를 배웠어. have to는 의무, I am used to는 익숙해졌다는 느낌.",
    source_note: "학원 수업",
    day_date: "260427"
  },
  expressions: [
    {
      english: "have to ~",
      korean_prompt: "~해야 한다 / ~할 필요가 있다",
      grammar_note: "주어가 3인칭 단수이면 has to를 쓴다.",
      examples: [{ example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm" }],
      user_memo: "선생님이 must보다 일상적으로 많이 쓴다고 설명함."
    },
    {
      english: "I am used to ~",
      korean_prompt: "~에 익숙하다 / ~에 익숙해졌다",
      grammar_note: "to 뒤에는 동사원형이 아니라 명사나 -ing가 온다.",
      examples: [{ example_text: "I am used to waking up early.", meaning_ko: "나는 일찍 일어나는 것에 익숙하다.", source: "llm" }],
      user_memo: "to 다음 형태를 자주 헷갈림."
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
