export function isFolderSchemaUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    ["42703", "42P01", "42883", "PGRST200", "PGRST204", "PGRST202"].includes(code)
    || text.includes("folder_id")
    || text.includes("content_folders")
    || text.includes("can_read_content_folder")
    || text.includes("schema cache")
  );
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : "";
}

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function isMissingColumnError(error: unknown, column: string) {
  const code = errorCode(error);
  const text = errorText(error);
  return ["42703", "PGRST204"].includes(code) && text.includes(column.toLowerCase());
}

export function isPermissionLikeError(error: unknown) {
  const code = errorCode(error);
  const text = errorText(error);
  return (
    ["42501", "PGRST301"].includes(code)
    || text.includes("row-level security")
    || text.includes("permission denied")
    || text.includes("not authorized")
    || text.includes("unauthorized")
  );
}

export function logFolderSchemaFallback(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  console.warn(`[topic-folder-access] ${scope}: folder schema unavailable, falling back to legacy read`, message);
}

export function raiseStoreError(operation: string, error: unknown): never {
  console.error(`[ExpressionStore] ${operation} failed`, error);
  throw error;
}

export function requireEntity<T>(entity: T | null | undefined, message: string): T {
  if (!entity) throw new Error(message);
  return entity;
}
