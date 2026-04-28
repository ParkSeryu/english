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

function canChildThroughParent(actorId: string | null, parentOwnerId: string) {
  return Boolean(actorId && actorId === parentOwnerId);
}

describe("Supabase RLS migration", () => {
  it.each(["lessons", "study_items", "study_examples", "ingestion_runs"])("enables RLS for %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(["lessons", "ingestion_runs"])("defines direct owner policies for %s", (table) => {
    for (const operation of ["select", "insert", "update", "delete"] as const) {
      expect(migration).toContain(`create policy "${table}_${operation}_own"`);
      expect(migration).toContain(`on public.${table}`);
    }
    expect(migration).toContain("owner_id = auth.uid()");
  });

  it("defines study_items owner and parent lesson policies", () => {
    expect(migration).toContain('create policy "study_items_select_own"');
    expect(migration).toContain('create policy "study_items_insert_owned_lesson"');
    expect(migration).toContain('create policy "study_items_update_own"');
    expect(migration).toContain('create policy "study_items_delete_own"');
    expect(migration).toContain("lessons.id = study_items.lesson_id");
    expect(migration).toContain("lessons.owner_id = auth.uid()");
  });

  it.each(["select", "insert", "update", "delete"] as const)("defines study_examples %s parent-item policy", (operation) => {
    expect(migration).toContain(`study_examples_${operation}_owned_item`);
    expect(migration).toContain("study_items.id = study_examples.study_item_id");
    expect(migration).toContain("study_items.owner_id = auth.uid()");
  });

  it("models unauthenticated and cross-owner denial for direct owner tables", () => {
    expect(canOwnerRow("select", null, "user-a")).toBe(false);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-b")).toBe(false);
    expect(canOwnerRow("update", "user-a", "user-b", "user-a")).toBe(false);
    expect(canOwnerRow("delete", "user-a", "user-b")).toBe(false);
  });

  it("models owner allow for direct owner tables", () => {
    expect(canOwnerRow("select", "user-a", "user-a")).toBe(true);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-a")).toBe(true);
    expect(canOwnerRow("update", "user-a", "user-a", "user-a")).toBe(true);
    expect(canOwnerRow("delete", "user-a", "user-a")).toBe(true);
  });

  it("models study_examples access through the owned parent item only", () => {
    expect(canChildThroughParent(null, "user-a")).toBe(false);
    expect(canChildThroughParent("user-a", "user-a")).toBe(true);
    expect(canChildThroughParent("user-a", "user-b")).toBe(false);
  });
});
