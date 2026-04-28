import { NextResponse } from "next/server";

import { authenticateIngestionRequest } from "@/lib/ingestion/request-auth";
import { getAdminLessonStore } from "@/lib/lesson-store";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const userOrResponse = authenticateIngestionRequest(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const body = (await request.json()) as { approvalText?: unknown };
  const approvalText = String(body.approvalText ?? "").trim();
  const { id } = await params;

  try {
    const result = await getAdminLessonStore(userOrResponse).approveDraft(id, approvalText);
    return NextResponse.json({ lesson: result.lesson, itemUrls: result.itemUrls });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to approve lesson" }, { status: 400 });
  }
}
