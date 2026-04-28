import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
  .join("\n");

type Operation = "select" | "insert" | "update" | "delete";

function canOwnerRow(operation: Operation, actorId: string | null, rowOwnerId: string, insertedOwnerId = rowOwnerId) {
  if (!actorId) return false;
  if (operation === "insert") return insertedOwnerId === actorId;
  if (operation === "update") return rowOwnerId === actorId && insertedOwnerId === actorId;
  return rowOwnerId === actorId;
}

function canChildThroughOwnedParent(actorId: string | null, parentOwnerId: string) {
  return Boolean(actorId && actorId === parentOwnerId);
}

describe("daily expression Supabase RLS migration", () => {
  it.each(["expression_days", "expressions", "question_notes", "ingestion_runs"])("enables RLS for %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(["expression_days", "question_notes", "ingestion_runs"])("defines direct owner policies for %s", (table) => {
    for (const operation of ["select", "insert", "update", "delete"] as const) {
      expect(migration).toContain(`create policy "${table}_${operation}_own"`);
      expect(migration).toContain(`on public.${table}`);
    }
    expect(migration).toContain("owner_id = auth.uid()");
  });

  it.each(["select", "insert", "update", "delete"] as const)("defines expressions %s parent-day policy", (operation) => {
    expect(migration).toContain(`expressions_${operation}_owned_day`);
    expect(migration).toContain("expression_days.id = expressions.day_id");
    expect(migration).toContain("expression_days.owner_id = auth.uid()");
  });

  it("models unauthenticated and cross-owner denial for direct owner tables", () => {
    expect(canOwnerRow("select", null, "user-a")).toBe(false);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-b")).toBe(false);
    expect(canOwnerRow("update", "user-a", "user-b", "user-a")).toBe(false);
    expect(canOwnerRow("delete", "user-a", "user-b")).toBe(false);
  });

  it("models expressions access only through the owned parent day", () => {
    expect(canChildThroughOwnedParent(null, "user-a")).toBe(false);
    expect(canChildThroughOwnedParent("user-a", "user-a")).toBe(true);
    expect(canChildThroughOwnedParent("user-a", "user-b")).toBe(false);
  });
});
