"use server";

import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import {
  readPropertyForm,
  toFormErrors,
  type PropertyFormValues,
} from "~/app/_lib/property-form";
import { type PublishFormState } from "~/app/publish/form-state";
import { api } from "~/trpc/server";

const LOGIN_URL = "/login?callbackUrl=/publish";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Publish flow (US-17.F1 / F2): validates the form with `createPropertySchema`, creates the
 * listing as a draft (`property.create`) and publishes it (`property.publish`), then opens its
 * page. As a form action it also works without JavaScript.
 *
 * Photos (US-18.F1) will go between the two calls; until then the listing is published right
 * away, as the contract allows (docs/api.md, open point 2).
 */
export async function publishProperty(
  previous: PublishFormState,
  form: FormData,
): Promise<PublishFormState> {
  const retryDraftId = form.get("draftId");
  let id: string;
  let values: PropertyFormValues;

  if (typeof retryDraftId === "string" && retryDraftId !== "") {
    // Retrying the publish of the draft created before: the fields are locked, keep them.
    id = retryDraftId;
    values = previous.values;
  } else {
    const read = readPropertyForm(form);
    values = read.values;
    if (!read.input) return { values, fieldErrors: read.fieldErrors };

    const created = await createDraft(read.input);
    if (created.error === "unauthorized") redirect(LOGIN_URL);
    if (created.error) return { values, ...created.error };
    id = created.id;
  }

  const published = await publishDraft(id);
  if (published === "unauthorized") redirect(LOGIN_URL);
  if (published === "failed") {
    return {
      values,
      draftId: id,
      formError:
        "Your listing was saved but couldn't be published. Please try again.",
    };
  }

  // Outside any try/catch: `redirect` works by throwing.
  redirect(`/properties/${id}`);
}

type CreateResult =
  | { id: string; error?: undefined }
  | { error: "unauthorized" }
  | { error: Pick<PublishFormState, "fieldErrors" | "formError"> };

async function createDraft(
  input: Parameters<typeof api.property.create>[0],
): Promise<CreateResult> {
  try {
    const property = await api.property.create(input);
    return { id: property.id };
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "UNAUTHORIZED") return { error: "unauthorized" };
      // The form already uses the server's schema, so this only happens if they drift apart.
      if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
        return {
          error: {
            fieldErrors: toFormErrors(error.cause.flatten().fieldErrors),
          },
        };
      }
    }
    console.error("property.create failed", error);
    return { error: { formError: GENERIC_ERROR } };
  }
}

async function publishDraft(
  id: string,
): Promise<"ok" | "unauthorized" | "failed"> {
  try {
    await api.property.publish({ id });
    return "ok";
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.code === "UNAUTHORIZED") return "unauthorized";
      // Already published (e.g. a second click that arrived later): it is live, so carry on.
      if (error.code === "CONFLICT") return "ok";
    }
    console.error("property.publish failed", error);
    return "failed";
  }
}
