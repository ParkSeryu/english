import { redirect } from "next/navigation";
import { cache } from "react";

import { MissingSupabaseEnvError, hasSupabaseEnv } from "@/lib/env";
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-cookie";
import {
  clearServerSupabaseAuthCookies,
  createServerSupabaseClient
} from "@/lib/supabase/server";
import { getE2EFakeUserId } from "@/lib/test-mode";
import type { UserIdentity } from "@/lib/types";

export const getCurrentUser = cache(async function getCurrentUser(): Promise<UserIdentity | null> {
  const fakeUserId = getE2EFakeUserId();
  if (fakeUserId) {
    return { id: fakeUserId, email: "e2e@example.com" };
  }

  if (!hasSupabaseEnv()) return null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearServerSupabaseAuthCookies();
      }
      return null;
    }
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email };
  } catch (error) {
    if (error instanceof MissingSupabaseEnvError) return null;
    if (isInvalidRefreshTokenError(error)) {
      await clearServerSupabaseAuthCookies();
      return null;
    }
    throw error;
  }
});

export async function requireCurrentUser(): Promise<UserIdentity> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
