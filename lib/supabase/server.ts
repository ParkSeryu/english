import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/env";
import { isSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

export async function createServerSupabaseClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Route handlers and server actions can.
        }
      }
    }
  });
}

export async function clearServerSupabaseAuthCookies() {
  const cookieStore = await cookies();
  const authCookies = cookieStore.getAll().filter((cookie) => isSupabaseAuthCookie(cookie.name));

  for (const cookie of authCookies) {
    try {
      cookieStore.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0
      });
    } catch {
      // Server Components cannot set cookies. Route handlers and server actions can.
    }
  }
}
