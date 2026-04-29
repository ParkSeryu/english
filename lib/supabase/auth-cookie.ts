const AUTH_COOKIE_NAME_SUFFIX = "auth-token";

export function isSupabaseAuthCookie(cookieName: string) {
  return cookieName.startsWith("sb-") && cookieName.includes(AUTH_COOKIE_NAME_SUFFIX);
}

export function isInvalidRefreshTokenError(error: unknown) {
  if (!(error && typeof error === "object")) return false;
  const typed = error as { code?: unknown; message?: unknown };
  const message = typeof typed.message === "string" ? typed.message : "";
  return (
    typed.code === "refresh_token_not_found" ||
    message.includes("Refresh Token Not Found") ||
    message.includes("Invalid Refresh Token")
  );
}
