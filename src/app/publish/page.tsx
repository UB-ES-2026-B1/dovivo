import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Publish a property" };

export default async function PublishPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin?callbackUrl=/publish");

  // TODO(frontend): multi-step form using `createPropertySchema` from
  // ~/lib/validators/property and the `property.create` + `property.publish` mutations.
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold">Publish a property</h1>
      <p className="mt-4 text-slate-600">
        Hi {session.user.name ?? "there"}, the publishing form goes here.
      </p>
    </main>
  );
}
