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
};

export const initialPublishFormState: PublishFormState = {
  values: emptyPropertyFormValues,
};
