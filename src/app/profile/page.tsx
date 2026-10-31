import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileDetails } from "~/app/profile/profile-details";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = { title: "My profile" };

/**
 * The signed-in user's profile (US-04.F1). Private: without a session it redirects to the login
 * and comes back here afterwards. The data comes from `user.me`, which only ever returns the
 * user in the session, so there is no id in the URL.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/profile");

  // Fetched on the server and handed to the client cache, so the page renders with the data and
  // profile editing (US-05) can update it in place with `utils.user.me.setData`.
  void api.user.me.prefetch();

  return (
    <HydrateClient>
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">My profile</h1>
        <ProfileDetails />
      </main>
    </HydrateClient>
  );
}
