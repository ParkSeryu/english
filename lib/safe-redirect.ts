const DEFAULT_REDIRECT_ORIGIN = "https://app.local";
const unsafePercentEncoding = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;

function hasUnsafeLiteralCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === "\\" || codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }

  return false;
}

function hasUnsafeRedirectCharacters(value: string) {
  let current = value;

  for (let depth = 0; depth < 3; depth += 1) {
    if (hasUnsafeLiteralCharacter(current) || unsafePercentEncoding.test(current)) {
      return true;
    }

    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) return false;
      current = decoded;
    } catch {
      return true;
    }
  }

  return hasUnsafeLiteralCharacter(current) || unsafePercentEncoding.test(current);
}

export function safeSameOriginRedirectPath(rawNext: string | null, origin = DEFAULT_REDIRECT_ORIGIN) {
  if (!rawNext?.startsWith("/") || rawNext.startsWith("//") || hasUnsafeRedirectCharacters(rawNext)) {
    return "/";
  }

  try {
    const baseUrl = new URL(origin);
    const candidate = new URL(rawNext, baseUrl);

    if (candidate.origin !== baseUrl.origin) {
      return "/";
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}` || "/";
  } catch {
    return "/";
  }
}
