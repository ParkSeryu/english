"use client";

import { ExpressionMemoForm } from "@/components/ExpressionMemoForm";
import type { ExpressionCard } from "@/lib/types";

export function ItemNotesForm({ item }: { item: ExpressionCard }) {
  return <ExpressionMemoForm expression={item} />;
}
