import { NextResponse } from "next/server";

import { resetMemoryCardStoreForTests } from "@/lib/card-store";
import { isE2EMemoryMode } from "@/lib/test-mode";

export async function POST() {
  if (!isE2EMemoryMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  resetMemoryCardStoreForTests();
  return NextResponse.json({ ok: true });
}
