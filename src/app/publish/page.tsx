import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { PublishForm } from "~/app/publish/publish-form";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Publish a property" };

/**
 * Publish a listing (US-17). Private: without a session it goes to the login and comes back here
 * afterwards ("No puc publicar sense haver iniciat sessió").
 */
export default async function PublishPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/publish");

  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">Publish a property</h1>
      <p className="mt-2 text-slate-600">
        Fill in the details of your home. Fields without &quot;(optional)&quot;
        are required.
      </p>
      <PublishForm />
    </main>
  );
}
