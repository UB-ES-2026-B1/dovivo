import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "~/app/login/login-form";
import { safeCallbackUrl } from "~/app/_lib/safe-callback-url";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);

  // Already signed in: nothing to do here.
  const session = await auth();
  if (session) redirect(callbackUrl);

  return (
    <main className="container mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <LoginForm callbackUrl={callbackUrl} />
      <p className="mt-6 text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-emerald-700 hover:underline"
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
