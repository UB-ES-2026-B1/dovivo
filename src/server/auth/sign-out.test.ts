import NextAuth from "next-auth";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { authConfig } from "~/server/auth/config";

/**
 * Sign-out (US-03) through the real Auth.js handlers, without a database: Auth.js only decodes the
 * JWT and clears the cookie, so no callback reaches the DB. Sessions are JWTs, so signing out
 * cannot revoke a copied token server-side (see docs/adr/0002-auth.md, "Consequences").
 */

const secret = "test-secret-for-sign-out";
const { handlers } = NextAuth({ ...authConfig, secret });

const BASE_URL = "http://localhost:3000/api/auth";
const SESSION_COOKIE = "authjs.session-token";
const CSRF_COOKIE = "authjs.csrf-token";

const sessionToken = () =>
  encode({
    token: { id: "user_1", role: "USER", sub: "user_1" },
    secret,
    salt: SESSION_COOKIE,
  });

/** `name=value` pairs from the response's Set-Cookie headers. */
const setCookies = (res: Response) =>
  new Map(
    res.headers.getSetCookie().map((cookie) => {
      const [pair = ""] = cookie.split(";");
      const index = pair.indexOf("=");
      return [pair.slice(0, index), { value: pair.slice(index + 1), cookie }];
    }),
  );

/** Asks Auth.js for a CSRF token, as `signOut()` from `next-auth/react` does first. */
async function getCsrf() {
  const res = await handlers.GET(new NextRequest(`${BASE_URL}/csrf`));
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  const cookie = setCookies(res).get(CSRF_COOKIE);
  if (!cookie) throw new Error("Auth.js did not set the CSRF cookie");
  return { csrfToken, cookie: `${CSRF_COOKIE}=${cookie.value}` };
}

const signOutRequest = (body: Record<string, string>, cookies: string[]) =>
  new NextRequest(`${BASE_URL}/signout`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies.join("; "),
    },
    body: new URLSearchParams(body),
  });

describe("sign-out (POST /api/auth/signout)", () => {
  it("clears the session cookie and redirects", async () => {
    const csrf = await getCsrf();
    const res = await handlers.POST(
      signOutRequest({ csrfToken: csrf.csrfToken, callbackUrl: "/" }, [
        csrf.cookie,
        `${SESSION_COOKIE}=${await sessionToken()}`,
      ]),
    );

    expect(res.status).toBe(302);
    const session = setCookies(res).get(SESSION_COOKIE);
    expect(session?.value).toBe("");
    expect(session?.cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("keeps the session when the CSRF token is missing", async () => {
    const csrf = await getCsrf();
    const res = await handlers.POST(
      signOutRequest({ callbackUrl: "/" }, [
        csrf.cookie,
        `${SESSION_COOKIE}=${await sessionToken()}`,
      ]),
    );

    expect(setCookies(res).has(SESSION_COOKIE)).toBe(false);
  });
});
