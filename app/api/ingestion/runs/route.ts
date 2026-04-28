import { NextResponse } from "next/server";

import { authenticateIngestionRequest } from "@/lib/ingestion/request-auth";
import { getAdminExpressionStore } from "@/lib/lesson-store";
import { parseExpressionIngestionPayload } from "@/lib/validation";

export async function POST(request: Request) {
  const userOrResponse = authenticateIngestionRequest(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const body = (await request.json()) as unknown;
  const parsed = parseExpressionIngestionPayload(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid expression-day payload", details: parsed.error.flatten() }, { status: 400 });

  const run = await getAdminExpressionStore(userOrResponse).createDraft(parsed.data);
  return NextResponse.json({ run }, { status: 201 });
}
