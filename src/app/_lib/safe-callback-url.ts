/**
 * Only same-site paths are allowed as `callbackUrl` (no open redirects).
 * "/publish" is OK; "https://evil.com" and "//evil.com" fall back to "/".
 */
export function safeCallbackUrl(value: string | string[] | undefined): string {
  const url = Array.isArray(value) ? value[0] : value;
  if (!url?.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) {
    return "/";
  }
  return url;
}
