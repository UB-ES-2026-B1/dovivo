type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  maxLength?: number;
  errors?: string[];
};

/** Labelled input with an optional hint and its first validation error. */
export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  maxLength,
  errors,
}: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = !!errors?.length;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-emerald-700 focus:outline-none aria-invalid:border-red-500"
      />
      {hint && !hasError && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
