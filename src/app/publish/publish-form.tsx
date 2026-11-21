"use client";

import { useActionState, useEffect, useRef } from "react";

import { PropertyFormFields } from "~/app/_components/property-form-fields";
import { publishProperty } from "~/app/publish/actions";
import { initialPublishFormState } from "~/app/publish/form-state";

/**
 * Publish form (US-17.F1 / F2). The server action validates, creates and publishes the listing
 * and then opens its page; on error it answers with the values as typed and one message per
 * field. Works without JavaScript too (a plain POST to the same action).
 */
export function PublishForm() {
  const [state, formAction, isPending] = useActionState(
    publishProperty,
    initialPublishFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move the focus to the first wrong field so keyboard and screen reader
  // users land on the error (the field's message is linked with aria-describedby).
  useEffect(() => {
    if (!state.fieldErrors) return;
    formRef.current
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  }, [state]);

  const retrying = !!state.draftId;

  return (
    <form ref={formRef} action={formAction} noValidate className="mt-8">
      {/*
        After "saved but not published" the fields are locked: the next submit only publishes the
        draft that already exists, so it can't create a second one.
      */}
      {state.draftId && (
        <input type="hidden" name="draftId" value={state.draftId} />
      )}
      <fieldset disabled={retrying || isPending} className="min-w-0">
        {/*
          `key` remounts the fields with the values the action returned: React resets a form after
          its action runs, and this way the reset shows what the user typed.
        */}
        <PropertyFormFields
          key={JSON.stringify(state.values)}
          values={state.values}
          errors={state.fieldErrors}
        />
      </fieldset>

      {state.formError && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.formError}
        </p>
      )}
      {state.fieldErrors && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          Some fields need fixing. Check the messages above.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-full bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
      >
        {isPending
          ? "Publishing…"
          : retrying
            ? "Try publishing again"
            : "Publish listing"}
      </button>
    </form>
  );
}
