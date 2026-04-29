import type { UserIdentity } from "@/lib/types";

export const AUTH_VERIFIED_HEADER = "x-english-auth-verified";
export const AUTH_USER_ID_HEADER = "x-english-user-id";
export const AUTH_USER_EMAIL_HEADER = "x-english-user-email";

type HeaderReader = {
  get(name: string): string | null;
};

type HeaderWriter = {
  delete(name: string): void;
  set(name: string, value: string): void;
};

export function clearTrustedAuthHeaders(headers: HeaderWriter) {
  headers.delete(AUTH_VERIFIED_HEADER);
  headers.delete(AUTH_USER_ID_HEADER);
  headers.delete(AUTH_USER_EMAIL_HEADER);
}

export function setTrustedAuthHeaders(headers: HeaderWriter, user: UserIdentity) {
  headers.set(AUTH_VERIFIED_HEADER, "1");
  headers.set(AUTH_USER_ID_HEADER, user.id);
  if (user.email) headers.set(AUTH_USER_EMAIL_HEADER, user.email);
}

export function userFromTrustedAuthHeaders(headers: HeaderReader): UserIdentity | null {
  if (headers.get(AUTH_VERIFIED_HEADER) !== "1") return null;

  const id = headers.get(AUTH_USER_ID_HEADER);
  if (!id) return null;

  return {
    id,
    email: headers.get(AUTH_USER_EMAIL_HEADER)
  };
}
