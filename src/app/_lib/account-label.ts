/** Shown in the header instead of the name when the user hasn't set one. */
export const ACCOUNT_FALLBACK_LABEL = "My profile";

/**
 * Text of the header's profile link (US-05): the signed-in user's name, so a profile edit is
 * visible at a glance, or "My profile" when the name is missing or blank.
 */
export function accountLabel(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed || ACCOUNT_FALLBACK_LABEL;
}
