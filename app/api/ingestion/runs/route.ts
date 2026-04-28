import { NextResponse } from "next/server";

import { authenticateIngestionRequest } from "@/lib/ingestion/request-auth";
import { getAdminLessonStore } from "@/lib/lesson-store";
import { parseLessonIngestionPayload } from "@/lib/validation";

export async function POST(request: Request) {
  const userOrResponse = authenticateIngestionRequest(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const body = (await request.json()) as unknown;
  const parsed = parseLessonIngestionPayload(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lesson payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const run = await getAdminLessonStore(userOrResponse).createDraft(parsed.data);
  return NextResponse.json({ run }, { status: 201 });
}
