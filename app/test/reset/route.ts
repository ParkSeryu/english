import { NextResponse } from "next/server";

import { resetMemoryLessonStoreForTests } from "@/lib/lesson-store";
import { isE2EMemoryMode } from "@/lib/test-mode";

export async function POST() {
  if (!isE2EMemoryMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  resetMemoryLessonStoreForTests();
  return NextResponse.json({ ok: true });
}
