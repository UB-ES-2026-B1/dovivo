import {
  emptyPropertyFormValues,
  type PropertyFormErrors,
  type PropertyFormValues,
} from "~/app/_lib/property-form";

// Not in `actions.ts`: a "use server" file can only export async functions.

export type PublishFormState = {
  /** The form as the user left it, to show it again after an error. */
  values: PropertyFormValues;
  fieldErrors?: PropertyFormErrors;
  formError?: string;
  /**
   * Set when the listing was created but `publish` failed: the next submit only retries the
   * publish, so a second try never creates a duplicate draft.
   */
  draftId?: string;
};

export const initialPublishFormState: PublishFormState = {
  values: emptyPropertyFormValues,
};
