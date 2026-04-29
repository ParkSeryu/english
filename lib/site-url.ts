const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

type HeaderReader = Pick<Headers, "get">;
type SiteUrlEnv = { [key: string]: string | undefined };

function originFromUrl(value: string | undefined, addHttps = false) {
  const rawValue = value?.trim();
  if (!rawValue) return null;
  const normalizedValue = addHttps && !/^https?:\/\//i.test(rawValue) ? `https://${rawValue}` : rawValue;

  try {
    const url = new URL(normalizedValue);
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function originFromForwardedHeaders(headers: HeaderReader) {
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!forwardedHost) return null;
  const forwardedProto = headers.get("x-forwarded-proto") ?? (forwardedHost.includes("localhost") ? "http" : "https");
  const firstHost = forwardedHost.split(",")[0]?.trim();
  const firstProto = forwardedProto.split(",")[0]?.trim() || "https";
  return originFromUrl(`${firstProto}://${firstHost}`);
}

export function resolveAppOrigin(headers: HeaderReader, env: SiteUrlEnv = process.env) {
  const configuredOrigin = originFromUrl(env.NEXT_PUBLIC_SITE_URL) ?? originFromUrl(env.SITE_URL);
  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) return configuredOrigin;

  const forwardedOrigin = originFromForwardedHeaders(headers);
  if (forwardedOrigin && !isLocalOrigin(forwardedOrigin)) return forwardedOrigin;

  const vercelOrigin = originFromUrl(env.VERCEL_PROJECT_PRODUCTION_URL, true) ?? originFromUrl(env.VERCEL_URL, true);
  if (vercelOrigin && !isLocalOrigin(vercelOrigin)) return vercelOrigin;

  return configuredOrigin ?? forwardedOrigin ?? originFromUrl(headers.get("origin") ?? undefined) ?? "http://localhost:3000";
}

export function passwordResetRedirectUrl(headers: HeaderReader, env: SiteUrlEnv = process.env) {
  return `${resolveAppOrigin(headers, env)}/auth/callback?next=/login`;
}
