import { describe, expect, it } from "vitest";

import { hasLostSession } from "~/app/_lib/session-lost";

/** Fake `GET /api/auth/session` answering `body` as JSON. */
const respond =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );

describe("hasLostSession", () => {
  it("is true when Auth.js answers that there is no session", async () => {
    expect(await hasLostSession(respond(null))).toBe(true);
  });

  it("is false while the session is still valid", async () => {
    const session = {
      user: { name: "Ana", email: "ana@example.com" },
      expires: "2026-11-25T00:00:00.000Z",
    };
    expect(await hasLostSession(respond(session))).toBe(false);
  });

  it("is false when the request fails, so a flaky network never reloads the page", async () => {
    const offline = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await hasLostSession(offline)).toBe(false);
  });

  it("is false on an error response", async () => {
    expect(
      await hasLostSession(respond({ message: "Server error" }, 500)),
    ).toBe(false);
  });
});
