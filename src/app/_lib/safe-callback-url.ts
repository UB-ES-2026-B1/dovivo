// Placeholder origin: only used to resolve the value and check it stays on the same site.
const SAME_SITE_BASE = "http://dovivo.invalid";

/**
 * Only same-site paths are allowed as `callbackUrl` (no open redirects).
 * "/publish" is OK; "https://evil.com", "//evil.com" and "/\t/evil.com" fall back to "/".
 *
 * The value is parsed with `URL`, as the browser will, instead of checked with string prefixes:
 * browsers drop tabs and newlines and treat `\` as `/`, so "/\t/evil.com" ends up as
 * "//evil.com". The normalised path is returned, so what we check is what the browser follows.
 */
export function safeCallbackUrl(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.startsWith("/")) return "/";

  let url: URL;
  try {
    url = new URL(raw, SAME_SITE_BASE);
  } catch {
    return "/";
  }
  if (url.origin !== SAME_SITE_BASE) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
