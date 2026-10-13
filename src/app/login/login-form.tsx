"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "~/app/_components/form-field";
import { PASSWORD_MAX_BYTES, signInSchema } from "~/lib/validators/auth";

type FieldErrors = Partial<Record<"email" | "password", string[]>>;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page
    setFieldErrors({});
    setFormError(null);

    // 1. Validate in the browser with the same schema the server uses.
    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    // 2. Ask Auth.js to check the credentials. Not tRPC: see docs/api.md.
    setIsPending(true);
    const res = await signIn("credentials", {
      ...parsed.data,
      redirect: false,
    });

    // 3. Errors are generic on purpose: never say whether the email exists.
    if (res?.code === "rate_limited") {
      setFormError("Too many attempts, try again later");
      setIsPending(false);
      return;
    }
    if (res?.error) {
      setFormError("Invalid email or password");
      setIsPending(false);
      return;
    }

    // 4. Signed in: go back where the user came from and refresh the header.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        errors={fieldErrors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={PASSWORD_MAX_BYTES}
        errors={fieldErrors.password}
      />

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
