import { NextResponse } from "next/server";

import { getLessonStore } from "@/lib/lesson-store";
import { getE2EFakeUserId, isE2EMemoryMode } from "@/lib/test-mode";
import type { LessonIngestionPayload } from "@/lib/types";

const sampleLesson: LessonIngestionPayload = {
  lesson: {
    title: "have to / be used to",
    raw_input: "어제 have to랑 I am used to를 배웠어. have to는 의무, I am used to는 익숙해졌다는 느낌.",
    source_note: "학원 수업",
    lesson_date: "2026-04-27"
  },
  items: [
    {
      expression: "have to ~",
      meaning_ko: "~해야 한다 / ~할 필요가 있다",
      core_nuance: "의무나 필요성을 일상적으로 표현할 때 쓴다.",
      structure_note: "have to + 동사원형",
      grammar_note: "주어가 3인칭 단수이면 has to를 쓴다.",
      examples: [{ example_text: "I have to study English.", meaning_ko: "나는 영어를 공부해야 한다.", source: "llm" }],
      confusion_note: "must보다 일상 대화에서 부드럽게 들릴 때가 많다.",
      user_memo: "선생님이 must보다 일상적으로 많이 쓴다고 설명함."
    },
    {
      expression: "I am used to ~",
      meaning_ko: "~에 익숙하다 / ~에 익숙해졌다",
      core_nuance: "어떤 상황이나 행동이 더 이상 낯설지 않은 상태.",
      structure_note: "be used to + 명사 / 동명사",
      grammar_note: "to 뒤에는 동사원형이 아니라 명사나 -ing가 온다.",
      examples: [{ example_text: "I am used to waking up early.", meaning_ko: "나는 일찍 일어나는 것에 익숙하다.", source: "llm" }],
      confusion_note: "used to + 동사원형(과거에 ~하곤 했다)과 구분한다.",
      user_memo: "to 다음 형태를 자주 헷갈림."
    }
  ]
};

export async function POST() {
  if (!isE2EMemoryMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fakeUserId = getE2EFakeUserId();
  if (!fakeUserId) return NextResponse.json({ error: "Missing fake user" }, { status: 500 });

  const store = getLessonStore({ id: fakeUserId, email: "e2e@example.com" });
  const draft = await store.createDraft(sampleLesson);
  const result = await store.approveDraft(draft.id, "이대로 앱에 넣어줘");
  return NextResponse.json({ lesson: result.lesson, itemUrls: result.itemUrls });
}
