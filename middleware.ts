import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clearTrustedAuthHeaders, setTrustedAuthHeaders } from "@/lib/auth-context";
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

function redirectRootAuthCodeToCallback(request: NextRequest) {
  if (request.nextUrl.pathname !== "/" || !request.nextUrl.searchParams.has("code")) return null;

  const callbackUrl = new URL("/auth/callback", request.url);
  request.nextUrl.searchParams.forEach((value, key) => callbackUrl.searchParams.append(key, value));
  if (!callbackUrl.searchParams.has("next")) callbackUrl.searchParams.set("next", "/auth/update-password");

  return NextResponse.redirect(callbackUrl);
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (next && next !== "/login") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

function nextWithHeaders(headers: Headers) {
  return NextResponse.next({ request: { headers } });
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
}

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => isSupabaseAuthCookie(cookie.name));
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  clearTrustedAuthHeaders(requestHeaders);

  if (isE2EMemoryMode()) return nextWithHeaders(requestHeaders);
  if (!hasSupabaseEnv()) return nextWithHeaders(requestHeaders);

  const rootAuthCodeRedirect = redirectRootAuthCodeToCallback(request);
  if (rootAuthCodeRedirect) return rootAuthCodeRedirect;

  const pathname = request.nextUrl.pathname;
  const isPublicPath = pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/");

  if (!hasAuthCookie(request)) {
    if (isProtectedPath(pathname)) return redirectToLogin(request);
    return nextWithHeaders(requestHeaders);
  }

  const { url, publishableKey } = getSupabaseEnv();
  const response = nextWithHeaders(requestHeaders);
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
    clearAuthCookies(response);

    if (!isPublicPath) {
      const redirectResponse = redirectToLogin(request);
      clearAuthCookies(redirectResponse);
      return redirectResponse;
    }
  }

  if (!data?.user && isProtectedPath(pathname)) {
    const redirectResponse = redirectToLogin(request);
    clearAuthCookies(redirectResponse);
    return redirectResponse;
  }

  if (data?.user) {
    setTrustedAuthHeaders(requestHeaders, { id: data.user.id, email: data.user.email });
  }

  if (data?.user && pathname === "/login") {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  const finalResponse = nextWithHeaders(requestHeaders);
  copyCookies(response, finalResponse);
  return finalResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|images/|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$).*)"]
};
