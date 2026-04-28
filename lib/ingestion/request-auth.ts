import { NextResponse } from "next/server";

import { MissingIngestionEnvError, getIngestionEnv } from "@/lib/env";
import type { UserIdentity } from "@/lib/types";

export function authenticateIngestionRequest(request: Request): UserIdentity | NextResponse {
  let env: ReturnType<typeof getIngestionEnv>;
  try {
    env = getIngestionEnv();
  } catch (error) {
    if (error instanceof MissingIngestionEnvError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.apiToken}`;
  if (authorization !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { id: env.ownerId, email: "llm-ingestion-owner@example.local" };
}
