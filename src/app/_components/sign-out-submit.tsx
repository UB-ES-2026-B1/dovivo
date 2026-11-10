"use client";

import { useFormStatus } from "react-dom";

import { primaryButtonClass } from "~/app/_components/button-styles";

/** Submit button of the header's sign-out form; shows progress while the server action runs. */
export function SignOutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${primaryButtonClass} disabled:opacity-60`}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
