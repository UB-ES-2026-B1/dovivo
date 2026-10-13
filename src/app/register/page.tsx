import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "~/app/register/register-form";
import { safeCallbackUrl } from "~/app/_lib/safe-callback-url";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Create an account" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);

  // Already signed in: nothing to do here.
  const session = await auth();
  if (session) redirect(callbackUrl);

  return (
    <main className="container mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">Create an account</h1>
      <RegisterForm callbackUrl={callbackUrl} />
      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-emerald-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
