"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "~/app/_components/form-field";
import { updateProfileSchema } from "~/lib/validators/user";
import { api, type RouterOutputs } from "~/trpc/react";

type Profile = RouterOutputs["user"]["me"];
type FieldErrors = Partial<Record<"name" | "phone", string[]>>;

type Props = {
  user: Profile;
  onCancel: () => void;
  /** Called once the changes are saved and the `user.me` cache holds the new profile. */
  onSaved: () => void;
};

/**
 * Profile edit mode (US-05.F1): prefilled with the current name and phone, per-field errors and a
 * Cancel button. The email is shown but can't be changed (#21). On save the returned profile is
 * written to the `user.me` cache, so the page shows it without reloading, and the server components
 * are refreshed so the header shows the new name too (US-05.F2).
 */
export function ProfileEditForm({ user, onCancel, onSaved }: Props) {
  const router = useRouter();
  const utils = api.useUtils();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const updateMe = api.user.updateMe.useMutation({
    onSuccess: (updated) => {
      utils.user.me.setData(undefined, updated);
      // Re-render the server components (the header) so they read the new name from
      // `session.user.name`. Client state, like the confirmation, is kept.
      router.refresh();
      onSaved();
    },
    onError: (error) => {
      const code = error.data?.code;
      if (code === "BAD_REQUEST" && error.data?.zodError) {
        setFieldErrors(error.data.zodError.fieldErrors);
      } else if (code === "UNAUTHORIZED") {
        router.push("/login?callbackUrl=/profile");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    // Same schema as the server, so the messages match and nothing is sent if a field is invalid.
    const parsed = updateProfileSchema.safeParse({
      name: form.get("name"),
      phone: form.get("phone"),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    updateMe.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        maxLength={80}
        defaultValue={user.name ?? ""}
        errors={fieldErrors.name}
      />
      <div>
        <p className="block text-sm font-medium">Email</p>
        <p className="mt-1 break-words text-slate-900">{user.email}</p>
        <p className="mt-1 text-xs text-slate-500">
          The email can&apos;t be changed.
        </p>
      </div>
      <Field
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        maxLength={30}
        hint="Optional. Leave it empty to remove it."
        defaultValue={user.phone ?? ""}
        errors={fieldErrors.phone}
      />
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={updateMe.isPending}
          className="rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {updateMe.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={updateMe.isPending}
          className="rounded-full border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
