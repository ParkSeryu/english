const production = process.env.NODE_ENV === "production";

export function isE2EMemoryMode() {
  return !production && process.env.E2E_MEMORY_STORE === "1" && Boolean(process.env.E2E_FAKE_USER_ID);
}

export function getE2EFakeUserId() {
  if (!isE2EMemoryMode()) return null;
  return process.env.E2E_FAKE_USER_ID ?? null;
}
