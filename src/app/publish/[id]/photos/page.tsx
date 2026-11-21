import { TRPCError } from "@trpc/server";
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PhotosStep } from "~/app/publish/[id]/photos/photos-step";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export const metadata: Metadata = { title: "Add photos" };

type Props = { params: Promise<{ id: string }> };

/**
 * Publish a listing, step 2 of 2 (US-18.F1 / F2): add up to 15 photos to the draft created in
 * step 1, choose the cover and the order, and publish. Only the owner, and only while the listing
 * is a draft: someone else's or a missing listing shows the 404, and a listing that is already
 * published opens its page.
 */
export default async function AddPhotosPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/publish/${id}/photos`)}`,
    );
  }

  let property;
  try {
    property = await api.property.byId({ id });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
    ) {
      notFound();
    }
    throw error;
  }
  // `byId` shows published listings to everyone: only the owner can add photos here.
  if (property.owner.id !== session.user.id) notFound();
  if (property.status !== "DRAFT") redirect(`/properties/${id}`);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-medium text-emerald-700">Step 2 of 2</p>
      <h1 className="mt-1 text-3xl font-bold">Add photos</h1>
      <p className="mt-2 break-words text-slate-600">
        Your listing &quot;{property.title}&quot; is saved as a draft. Add
        photos of your home and publish it when you are ready.
      </p>
      <PhotosStep propertyId={property.id} initialPhotos={property.images} />
    </main>
  );
}
