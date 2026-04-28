import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const authHelper = readFileSync("lib/ingestion/request-auth.ts", "utf8");
const approveRoute = readFileSync("app/api/ingestion/runs/[id]/approve/route.ts", "utf8");
const expressionStore = readFileSync("lib/lesson-store.ts", "utf8");

describe("LLM ingestion route safety", () => {
  it("requires bearer token authentication before ingestion routes run", () => {
    expect(authHelper).toContain("authorization");
    expect(authHelper).toContain("Bearer");
    expect(authHelper).toContain("Unauthorized");
    expect(approveRoute).toContain("authenticateIngestionRequest");
  });

  it("assigns ingestion owner from server env rather than request JSON", () => {
    expect(authHelper).toContain("env.ownerId");
    expect(authHelper).not.toContain("request.json");
    expect(expressionStore).toContain("owner_id: this.user.id");
  });

  it("approval endpoint calls the explicit approval gate before inserting expression rows", () => {
    const approvalIndex = expressionStore.indexOf("isExplicitLessonSaveApproval");
    const insertIndex = expressionStore.indexOf('.from("expression_days")');
    expect(approvalIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(approvalIndex);
  });
});
