"use client";

import { MemorizeCard } from "@/components/MemorizeCard";
import type { ExpressionCard } from "@/lib/types";

export function ReviewCard({ item, returnTo = "/memorize" }: { item: ExpressionCard; mode?: unknown; returnTo?: string }) {
  return <MemorizeCard expression={item} returnTo={returnTo} />;
}
