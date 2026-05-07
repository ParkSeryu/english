import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isE2EMemoryMode } from "@/lib/test-mode";
import type { UserIdentity } from "@/lib/types";
import type { ExpressionStore } from "@/lib/expression-store/contract";
import { MemoryExpressionStore } from "@/lib/expression-store/memory-store";
import { SupabaseExpressionStore } from "@/lib/expression-store/supabase-store";

export function getExpressionStore(user: UserIdentity): ExpressionStore {
  if (isE2EMemoryMode()) return new MemoryExpressionStore(user);
  return new SupabaseExpressionStore(user);
}

export function getAdminExpressionStore(user: UserIdentity): ExpressionStore {
  if (isE2EMemoryMode()) return new MemoryExpressionStore(user);
  return new SupabaseExpressionStore(user, createServiceRoleSupabaseClient);
}

// Backward-compatible names for existing imports while the app routes move to expression terminology.
export const MemoryLessonStore = MemoryExpressionStore;
export const getLessonStore = getExpressionStore;
export const getAdminLessonStore = getAdminExpressionStore;
export type LessonStore = ExpressionStore;
