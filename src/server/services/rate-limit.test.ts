import { describe, expect, it } from "vitest";

import {
  checkSignInRateLimit,
  createRateLimiter,
  createSignInLimiters,
  getClientIp,
  SIGN_IN_PER_EMAIL_LIMIT,
  SIGN_IN_PER_IP_LIMIT,
  SIGN_IN_WINDOW_MS,
} from "./rate-limit";

const makeClock = (start = 1_000_000) => {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks with a retry delay", () => {
    const clock = makeClock();
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);

    clock.advance(400);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 600 });
  });

  it("counts keys independently", () => {
    const clock = makeClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("resets once the window has passed", () => {
    const clock = makeClock();
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: clock.now,
    });

    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(999);
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(1);
    expect(limiter.check("a")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("blocks everything with a limit of 0", () => {
    const limiter = createRateLimiter({ limit: 0, windowMs: 1000 });
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("reset() forgets every counter", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    limiter.reset();
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("checkSignInRateLimit", () => {
  it("changing the email does not bypass the per-IP limit", () => {
    const limiters = createSignInLimiters();
    for (let i = 0; i < SIGN_IN_PER_IP_LIMIT; i++) {
      expect(
        checkSignInRateLimit(limiters, {
          ip: "203.0.113.7",
          email: `user${i}@example.com`,
        }),
      ).toBe(true);
    }
    expect(
      checkSignInRateLimit(limiters, {
        ip: "203.0.113.7",
        email: "fresh@example.com",
      }),
    ).toBe(false);
    // Another IP can still try that email.
    expect(
      checkSignInRateLimit(limiters, {
        ip: "198.51.100.1",
        email: "fresh@example.com",
      }),
    ).toBe(true);
  });

  it("changing the IP does not bypass the per-email limit", () => {
    const limiters = createSignInLimiters();
    for (let i = 0; i < SIGN_IN_PER_EMAIL_LIMIT; i++) {
      expect(
        checkSignInRateLimit(limiters, {
          ip: `198.51.100.${i}`,
          email: "victim@example.com",
        }),
      ).toBe(true);
    }
    expect(
      checkSignInRateLimit(limiters, {
        ip: "192.0.2.200",
        email: "victim@example.com",
      }),
    ).toBe(false);
    // Unknown IPs are still subject to the per-email limit.
    expect(
      checkSignInRateLimit(limiters, { ip: null, email: "victim@example.com" }),
    ).toBe(false);
    // Other accounts are unaffected.
    expect(
      checkSignInRateLimit(limiters, {
        ip: "192.0.2.200",
        email: "other@example.com",
      }),
    ).toBe(true);
  });

  it("skips the per-IP limit when the IP is unknown", () => {
    const limiters = createSignInLimiters();
    for (let i = 0; i < SIGN_IN_PER_IP_LIMIT + 5; i++) {
      expect(
        checkSignInRateLimit(limiters, {
          ip: null,
          email: `user${i}@example.com`,
        }),
      ).toBe(true);
    }
  });

  it("allows attempts again after the window", () => {
    const clock = makeClock();
    const limiters = createSignInLimiters(clock.now);
    const attempt = { ip: "203.0.113.7", email: "ada@example.com" };
    for (let i = 0; i < SIGN_IN_PER_EMAIL_LIMIT; i++) {
      checkSignInRateLimit(limiters, attempt);
    }
    expect(checkSignInRateLimit(limiters, attempt)).toBe(false);

    clock.advance(SIGN_IN_WINDOW_MS);
    expect(checkSignInRateLimit(limiters, attempt)).toBe(true);
  });
});

describe("getClientIp", () => {
  const xff = (value: string) => new Headers({ "x-forwarded-for": value });

  it("with no trusted proxy, uses the rightmost X-Forwarded-For entry", () => {
    // What Next.js sets from the socket when the client sent no header.
    expect(getClientIp(xff("203.0.113.7"), 0)).toBe("203.0.113.7");
    // A client-sent header can't be told apart from a real one without a proxy; at least the
    // forged left-hand entries are ignored.
    expect(getClientIp(xff("1.1.1.1, 203.0.113.7"), 0)).toBe("203.0.113.7");
  });

  it("with one proxy, picks the address that proxy appended, not a forged one", () => {
    // Client forged "1.1.1.1"; our proxy appended the real client address.
    expect(getClientIp(xff(" 1.1.1.1 , 203.0.113.7 "), 1)).toBe("203.0.113.7");
  });

  it("with two proxies, skips the inner proxy's address", () => {
    // client -> proxy A (appends client) -> proxy B (appends A) -> app
    expect(getClientIp(xff("1.1.1.1, 203.0.113.7, 10.0.0.2"), 2)).toBe(
      "203.0.113.7",
    );
  });

  it("returns null when there are fewer entries than trusted proxies", () => {
    expect(getClientIp(xff("203.0.113.7"), 2)).toBeNull();
  });

  it("returns null for an empty entry", () => {
    expect(getClientIp(xff("203.0.113.7, "), 1)).toBeNull();
  });

  it("falls back to X-Real-IP only without X-Forwarded-For, else null", () => {
    expect(getClientIp(new Headers({ "x-real-ip": " 198.51.100.1 " }), 0)).toBe(
      "198.51.100.1",
    );
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "203.0.113.7",
          "x-real-ip": "9.9.9.9",
        }),
        1,
      ),
    ).toBe("203.0.113.7");
    expect(getClientIp(new Headers(), 0)).toBeNull();
  });
});
