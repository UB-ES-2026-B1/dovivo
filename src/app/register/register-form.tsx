"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "~/app/_components/form-field";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
} from "~/lib/validators/auth";
import { api } from "~/trpc/react";

type FieldErrors = Partial<Record<"name" | "email" | "password", string[]>>;

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const signUp = api.auth.signUp.useMutation({
    onSuccess: async (_user, { email, password }) => {
      // Account created: sign in with the same credentials to start the session.
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setFormError("Account created, but sign-in failed. Try logging in.");
        return;
      }
      router.push(callbackUrl);
      router.refresh(); // re-render server components (header) with the new session
    },
    onError: (error) => {
      const code = error.data?.code;
      if (code === "CONFLICT") {
        setFieldErrors({ email: ["This email is already registered"] });
      } else if (code === "TOO_MANY_REQUESTS") {
        setFormError("Too many attempts, try again later");
      } else if (code === "BAD_REQUEST" && error.data?.zodError) {
        setFieldErrors(error.data.zodError.fieldErrors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    // Same schema as the server, so the messages match.
    const parsed = signUpSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    signUp.mutate(parsed.data);
  }

  const isPending = signUp.isPending || signUp.isSuccess;

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        errors={fieldErrors.name}
      />
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
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
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
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
