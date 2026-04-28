import { NextResponse } from "next/server";

import { authenticateIngestionRequest } from "@/lib/ingestion/request-auth";
import { getAdminExpressionStore } from "@/lib/lesson-store";
import { parseExpressionIngestionPayload } from "@/lib/validation";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const userOrResponse = authenticateIngestionRequest(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const { id } = await params;
  const run = await getAdminExpressionStore(userOrResponse).getIngestionRun(id);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const userOrResponse = authenticateIngestionRequest(request);
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  const body = (await request.json()) as unknown;
  const parsed = parseExpressionIngestionPayload(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid expression-day payload", details: parsed.error.flatten() }, { status: 400 });

  const { id } = await params;
  const run = await getAdminExpressionStore(userOrResponse).reviseDraft(id, parsed.data);
  return NextResponse.json({ run });
}
