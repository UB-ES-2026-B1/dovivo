const fetchSession = () => fetch("/api/auth/session", { cache: "no-store" });

/**
 * Whether the browser no longer has a session (signed out here or in another tab, expired, or
 * blocked). Auth.js answers `GET /api/auth/session` with JSON `null` when there is none. A network
 * error or an error response counts as "not lost", so a flaky connection never reloads the page
 * and throws away what the user typed.
 */
export async function hasLostSession(
  getSession: () => Promise<Response> = fetchSession,
): Promise<boolean> {
  try {
    const res = await getSession();
    if (!res.ok) return false;
    return (await res.json()) === null;
  } catch {
    return false;
  }
}
