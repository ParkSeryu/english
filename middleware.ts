import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/env";
import { isInvalidRefreshTokenError, isSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import { isE2EMemoryMode } from "@/lib/test-mode";

const protectedPathPrefixes = [
  "/cards",
  "/expressions",
  "/items",
  "/lessons",
  "/memorize",
  "/questions",
  "/review"
];

function isProtectedPath(pathname: string) {
  return protectedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (next && next !== "/login") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  if (isE2EMemoryMode()) return NextResponse.next();
  if (!hasSupabaseEnv()) return NextResponse.next();

  const { url, publishableKey } = getSupabaseEnv();
  const response = NextResponse.next();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          if (options) {
            response.cookies.set({
              name,
              value,
              ...options
            });
          } else {
            response.cookies.set(name, value);
          }
        });
      }
    }
  });

  const { data, error } = await supabase.auth.getUser();

  const clearAuthCookies = (target: NextResponse) => {
    request.cookies.getAll().forEach((cookie) => {
      if (isSupabaseAuthCookie(cookie.name)) {
        target.cookies.delete({ name: cookie.name, path: "/" });
      }
    });
  };

  if (error && isInvalidRefreshTokenError(error)) {
    const pathname = request.nextUrl.pathname;
    const isPublicPath = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/_next/");

    clearAuthCookies(response);

    if (!isPublicPath) {
      const redirectResponse = redirectToLogin(request);
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }
  }

  if (!data?.user && isProtectedPath(request.nextUrl.pathname)) {
    const redirectResponse = redirectToLogin(request);
    clearAuthCookies(redirectResponse);
    return redirectResponse;
  }

  if (data?.user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|images/|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$).*)"]
};
