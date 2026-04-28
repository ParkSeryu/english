import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260428022608_create_study_cards.sql", "utf8");

type Operation = "select" | "insert" | "update" | "delete";

function canStudyCard(operation: Operation, actorId: string | null, rowOwnerId: string, insertedOwnerId = rowOwnerId) {
  if (!actorId) return false;
  if (operation === "insert") return insertedOwnerId === actorId;
  if (operation === "update") return rowOwnerId === actorId && insertedOwnerId === actorId;
  return rowOwnerId === actorId;
}

function canExample(actorId: string | null, parentOwnerId: string) {
  return Boolean(actorId && actorId === parentOwnerId);
}

describe("Supabase RLS migration", () => {
  it("enables RLS for both owner-scoped tables", () => {
    expect(migration).toContain("alter table public.study_cards enable row level security");
    expect(migration).toContain("alter table public.card_examples enable row level security");
  });

  it.each(["select", "insert", "update", "delete"] as const)("defines study_cards %s owner policy", (operation) => {
    expect(migration).toContain(`for ${operation}`);
    expect(migration).toContain("owner_id = auth.uid()");
  });

  it.each(["select", "insert", "update", "delete"] as const)("defines card_examples %s parent-owner policy", (operation) => {
    expect(migration).toContain(`card_examples_${operation}_owned_parent`);
    expect(migration).toContain("study_cards.id = card_examples.card_id");
    expect(migration).toContain("study_cards.owner_id = auth.uid()");
  });

  it("models unauthenticated and cross-owner denial for study_cards", () => {
    expect(canStudyCard("select", null, "user-a")).toBe(false);
    expect(canStudyCard("insert", "user-a", "user-a", "user-b")).toBe(false);
    expect(canStudyCard("update", "user-a", "user-b", "user-a")).toBe(false);
    expect(canStudyCard("delete", "user-a", "user-b")).toBe(false);
  });

  it("models owner allow for study_cards", () => {
    expect(canStudyCard("select", "user-a", "user-a")).toBe(true);
    expect(canStudyCard("insert", "user-a", "user-a", "user-a")).toBe(true);
    expect(canStudyCard("update", "user-a", "user-a", "user-a")).toBe(true);
    expect(canStudyCard("delete", "user-a", "user-a")).toBe(true);
  });

  it("models card_examples access through the owned parent card only", () => {
    expect(canExample(null, "user-a")).toBe(false);
    expect(canExample("user-a", "user-a")).toBe(true);
    expect(canExample("user-a", "user-b")).toBe(false);
  });
});
