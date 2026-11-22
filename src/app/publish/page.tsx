import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { PublishForm } from "~/app/publish/publish-form";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Publish a property" };

/**
 * Publish a listing, step 1 of 2 (US-17): the details. Step 2 adds the photos (US-18). Private:
 * without a session it goes to the login and comes back here afterwards ("No puc publicar sense haver iniciat sessió").
 */
export default async function PublishPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/publish");

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-medium text-emerald-700">Step 1 of 2</p>
      <h1 className="mt-1 text-3xl font-bold">Publish a property</h1>
      <p className="mt-2 text-slate-600">
        Fill in the details of your home. Fields without &quot;(optional)&quot;
        are required. You&apos;ll add the photos in the next step.
      </p>
      <PublishForm />
    </main>
  );
}
