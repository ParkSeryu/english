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

function canReadSharedExpressionContent(actorId: string | null) {
  return Boolean(actorId);
}

describe("daily expression Supabase RLS migration", () => {
  it.each(["expression_days", "expressions", "expression_examples", "expression_progress", "question_notes", "ingestion_runs"])("enables RLS for %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(["expression_progress", "question_notes", "ingestion_runs"])("defines direct owner policies for %s", (table) => {
    for (const operation of ["select", "insert", "update", "delete"] as const) {
      expect(migration).toContain(`create policy "${table}_${operation}_own"`);
      expect(migration).toContain(`on public.${table}`);
    }
    expect(migration).toContain("owner_id = auth.uid()");
  });

  it("defines shared read policies for expression content", () => {
    expect(migration).toContain('create policy "expression_days_select_authorized"');
    expect(migration).toContain('create policy "expressions_select_authorized"');
    expect(migration).toContain('create policy "expression_examples_select_authorized_expression"');
    expect(migration).toContain("can_read_content_folder(auth.uid(), folder_id)");
    expect(migration).toContain("auth.uid() is not null");
  });

  it("disambiguates content folder ACL function arguments from table columns", () => {
    expect(migration).toContain("function public.can_read_content_folder(auth_user_id uuid, folder_id uuid)");
    expect(migration).toContain("where cf.id = $2");
    expect(migration).toContain("and m.user_id = $1");
  });

  it("lets authenticated users read authorized content folders through the ACL helper", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain('create policy "content_folders_select_authorized"');
    expect(migration).toContain("on public.content_folders");
    expect(migration).toContain("using (public.can_read_content_folder(auth.uid(), id))");
  });

  it("removes authenticated write policies from shared expression content", () => {
    expect(migration).toContain('drop policy if exists "expression_days_insert_own"');
    expect(migration).toContain('drop policy if exists "expressions_insert_owned_day"');
    expect(migration).toContain('drop policy if exists "expression_examples_insert_owned_expression"');
  });

  it("grants authenticated learners the table privileges needed for private expression saves", () => {
    expect(migration).toContain("grant insert, delete on public.expression_days, public.expressions to authenticated");
    expect(migration).toContain('create policy "expression_days_insert_private_user"');
    expect(migration).toContain('create policy "expressions_insert_private_user"');
    expect(migration).toContain('create policy "expression_days_delete_private_user"');
    expect(migration).toContain('create policy "expressions_delete_private_user"');
  });

  it("models unauthenticated and cross-owner denial for direct owner tables", () => {
    expect(canOwnerRow("select", null, "user-a")).toBe(false);
    expect(canOwnerRow("insert", "user-a", "user-a", "user-b")).toBe(false);
    expect(canOwnerRow("update", "user-a", "user-b", "user-a")).toBe(false);
    expect(canOwnerRow("delete", "user-a", "user-b")).toBe(false);
  });

  it("models shared content reads for any authenticated user", () => {
    expect(canReadSharedExpressionContent(null)).toBe(false);
    expect(canReadSharedExpressionContent("user-a")).toBe(true);
    expect(canReadSharedExpressionContent("user-b")).toBe(true);
  });
});
