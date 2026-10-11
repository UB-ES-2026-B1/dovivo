/**
 * Minimal fixed-window rate limiter kept in memory.
 *
 * Limitation: counts live in this server process only. That is fine for a single-instance
 * deployment (local dev, staging), but with several instances or serverless functions each one
 * keeps its own counts, so the effective limit multiplies. Scaling out needs a shared store
 * (e.g. Redis) behind the same `check(key)` interface.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Milliseconds until the current window ends (0 when allowed). */
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
  /** Forget all counters. Meant for tests. */
  reset(): void;
};

export type RateLimiterOptions = {
  /** Maximum number of calls allowed per key within one window. */
  limit: number;
  windowMs: number;
  /** Clock, injectable for tests. */
  now?: () => number;
};

type Window = { count: number; resetAt: number };

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, Window>();
  let nextPruneAt = 0;

  // Drop expired windows at most once per window length, so the Map can't grow without bound
  // while keeping `check` O(1) on average.
  const prune = (at: number) => {
    if (at < nextPruneAt) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= at) windows.delete(key);
    }
    nextPruneAt = at + windowMs;
  };

  return {
    check(key) {
      const at = now();
      prune(at);

      let current = windows.get(key);
      if (!current || current.resetAt <= at) {
        current = { count: 0, resetAt: at + windowMs };
        windows.set(key, current);
      }

      if (current.count >= limit) {
        return { allowed: false, retryAfterMs: current.resetAt - at };
      }

      current.count += 1;
      return { allowed: true, retryAfterMs: 0 };
    },
    reset() {
      windows.clear();
      nextPruneAt = 0;
    },
  };
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** Sign-ups allowed per client IP per window (skipped when the IP is unknown). */
export const SIGN_UP_PER_IP_LIMIT = 5;
export const SIGN_UP_WINDOW_MS = FIFTEEN_MINUTES_MS;

/**
 * Sign-in attempts allowed per client IP per window, across all emails (skipped when the IP is
 * unknown). Slows down one client trying many accounts (credential stuffing).
 */
export const SIGN_IN_PER_IP_LIMIT = 30;
/**
 * Sign-in attempts allowed per email per window, from any IP. Protects one account from
 * distributed password guessing. Trade-off: anyone can lock an account's password sign-in for
 * one window by burning its attempts; acceptable at our scale, revisit with CAPTCHA if abused.
 */
export const SIGN_IN_PER_EMAIL_LIMIT = 10;
export const SIGN_IN_WINDOW_MS = FIFTEEN_MINUTES_MS;

export const signUpRateLimiter = createRateLimiter({
  limit: SIGN_UP_PER_IP_LIMIT,
  windowMs: SIGN_UP_WINDOW_MS,
});

export type SignInLimiters = { perIp: RateLimiter; perEmail: RateLimiter };

export const createSignInLimiters = (now?: () => number): SignInLimiters => ({
  perIp: createRateLimiter({
    limit: SIGN_IN_PER_IP_LIMIT,
    windowMs: SIGN_IN_WINDOW_MS,
    now,
  }),
  perEmail: createRateLimiter({
    limit: SIGN_IN_PER_EMAIL_LIMIT,
    windowMs: SIGN_IN_WINDOW_MS,
    now,
  }),
});

export const signInLimiters = createSignInLimiters();

/**
 * Counts one sign-in attempt and returns whether it may proceed. Checked in order, stopping at the
 * first limit hit: per IP (only when the IP is known), then per email.
 *
 * There is no separate per IP + email limiter: the per-email limit already caps every
 * IP + email pair, so it would never trigger first.
 */
export function checkSignInRateLimit(
  limiters: SignInLimiters,
  attempt: { ip: string | null; email: string },
): boolean {
  if (attempt.ip !== null && !limiters.perIp.check(attempt.ip).allowed) {
    return false;
  }
  return limiters.perEmail.check(attempt.email).allowed;
}

const nonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null; // missing or empty
  return trimmed;
};

/**
 * Client IP for rate limiting, or `null` when it can't be determined (callers must then skip
 * IP-based limits rather than share one bucket between all such clients).
 *
 * `X-Forwarded-For` is a comma-separated list where every hop APPENDS the address it received the
 * request from, so only the right-hand entries written by our own infrastructure are trustworthy;
 * anything to their left was sent by the client and can be forged. Next.js itself only sets the
 * header from the socket when it is missing.
 *
 * `trustedProxyCount` is the number of reverse proxies in front of the app (`TRUSTED_PROXY_COUNT`):
 * - `0` (no proxy): use the rightmost entry. If the client sent no header, Next wrote the socket
 *   address there; if it did send one, the value is client-controlled and can be spoofed, which
 *   is unavoidable without a proxy (the per-email limit still applies).
 * - `N >= 1`: the entry `N` positions from the right (`entries[length - N]`). With one proxy that
 *   appends the client address, that is the rightmost entry (the real client); with two, the
 *   rightmost is the first proxy's address and the client is the one before it, and so on.
 *
 * If the header has fewer entries than expected, the request did not come through our proxies,
 * so it is not trusted (`null`). Without `X-Forwarded-For` at all, `X-Real-IP` is used.
 *
 * Treat the result as a throttling key, not as an identity.
 */
export function getClientIp(
  headers: Headers,
  trustedProxyCount: number,
): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor === null) return nonEmpty(headers.get("x-real-ip"));

  const entries = forwardedFor.split(",");
  const fromRight = Math.max(trustedProxyCount, 1);
  if (entries.length < fromRight) return null;
  return nonEmpty(entries[entries.length - fromRight]);
}
