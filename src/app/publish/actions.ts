"use server";

import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { readPropertyForm, toFormErrors } from "~/app/_lib/property-form";
import { type PublishFormState } from "~/app/publish/form-state";
import { api } from "~/trpc/server";

const LOGIN_URL = "/login?callbackUrl=/publish";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Publish flow, step 1 of 2 (US-17.F1 / F2): validates the form with `createPropertySchema`,
 * saves the listing as a draft (`property.create`) and opens the photos step
 * (`/publish/[id]/photos`, US-18), where the user adds photos and publishes it. As a form action
 * it also works without JavaScript.
 */
export async function createListing(
  _previous: PublishFormState,
  form: FormData,
): Promise<PublishFormState> {
  const { values, input, fieldErrors } = readPropertyForm(form);
  if (!input) return { values, fieldErrors };

  let id: string;
  try {
    const property = await api.property.create(input);
    id = property.id;
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "UNAUTHORIZED") redirect(LOGIN_URL);
      // The form already uses the server's schema, so this only happens if they drift apart.
      if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
        return {
          values,
          fieldErrors: toFormErrors(error.cause.flatten().fieldErrors),
        };
      }
    }
    console.error("property.create failed", error);
    return { values, formError: GENERIC_ERROR };
  }

  // Outside the try/catch: `redirect` works by throwing.
  redirect(`/publish/${id}/photos`);
}
