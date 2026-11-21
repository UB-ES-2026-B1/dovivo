"use server";

import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";

import { type PublishDraftState } from "~/app/publish/[id]/photos/form-state";
import { api } from "~/trpc/server";

/**
 * Publish flow, step 2 of 2 (US-17 / US-18): publishes the draft (`property.publish`) and opens
 * its page. The photos are already saved one by one as they are uploaded, so this only changes
 * the status. A form action, so it also works without JavaScript.
 */
export async function publishDraft(
  _previous: PublishDraftState,
  form: FormData,
): Promise<PublishDraftState> {
  const id = form.get("propertyId");
  if (typeof id !== "string" || id.trim() === "") {
    return { error: "This listing doesn't exist any more or isn't yours." };
  }

  try {
    await api.property.publish({ id });
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "UNAUTHORIZED") {
        redirect(
          `/login?callbackUrl=${encodeURIComponent(`/publish/${id}/photos`)}`,
        );
      }
      // Already published (a second click, another tab): it is live, so open it.
      if (error.code === "CONFLICT") redirect(`/properties/${id}`);
      if (
        error.code === "NOT_FOUND" ||
        error.code === "FORBIDDEN" ||
        error.code === "BAD_REQUEST"
      ) {
        return { error: "This listing doesn't exist any more or isn't yours." };
      }
    }
    console.error("property.publish failed", error);
    return {
      error:
        "Your listing is saved as a draft but couldn't be published. Please try again.",
    };
  }

  // Outside the try/catch: `redirect` works by throwing.
  redirect(`/properties/${id}`);
}
