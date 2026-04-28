import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort().map((file) => readFileSync(`supabase/migrations/${file}`, "utf8")).join("\n");

type Operation = "select" | "insert" | "update" | "delete";
function canOwnerRow(operation: Operation, actorId: string | null, rowOwnerId: string, insertedOwnerId = rowOwnerId) {
  if (!actorId) return false;
  if (operation === "insert") return insertedOwnerId === actorId;
  if (operation === "update") return rowOwnerId === actorId && insertedOwnerId === actorId;
  return rowOwnerId === actorId;
}
function canChildThroughParent(actorId: string | null, parentOwnerId: string) { return Boolean(actorId && actorId === parentOwnerId); }

describe("Supabase expression RLS migration", () => {
  it.each(["expression_days", "expressions", "expression_examples", "question_notes", "ingestion_runs"])("enables RLS for %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(["expression_days", "question_notes", "ingestion_runs"])("defines direct owner policies for %s", (table) => {
    for (const operation of ["select", "insert", "update", "delete"] as const) expect(migration).toContain(`create policy "${table}_${operation}_own"`);
    expect(migration).toContain("owner_id = auth.uid()");
  });

  it("defines expressions owner and parent day policies", () => {
    expect(migration).toContain('create policy "expressions_select_own"');
    expect(migration).toContain('create policy "expressions_insert_owned_day"');
    expect(migration).toContain('create policy "expressions_update_own"');
    expect(migration).toContain("expression_days.id = expressions.expression_day_id");
    expect(migration).toContain("expression_days.owner_id = auth.uid()");
  });

  it.each(["select", "insert", "update", "delete"] as const)("defines expression_examples %s parent-expression policy", (operation) => {
    expect(migration).toContain(`expression_examples_${operation}_owned_expression`);
    expect(migration).toContain("expressions.id = expression_examples.expression_id");
    expect(migration).toContain("expressions.owner_id = auth.uid()");
  });

  it("models unauthenticated and cross-owner denial for direct owner tables", () => {
    expect(canOwnerRow("select", null, "user-a")).toBe(false);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-b")).toBe(false);
    expect(canOwnerRow("update", "user-a", "user-b", "user-a")).toBe(false);
    expect(canOwnerRow("delete", "user-a", "user-b")).toBe(false);
  });

  it("models owner allow and child access through owned parent only", () => {
    expect(canOwnerRow("select", "user-a", "user-a")).toBe(true);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-a")).toBe(true);
    expect(canChildThroughParent(null, "user-a")).toBe(false);
    expect(canChildThroughParent("user-a", "user-a")).toBe(true);
    expect(canChildThroughParent("user-a", "user-b")).toBe(false);
  });
});
