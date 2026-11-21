import { Field } from "~/app/_components/form-field";
import {
  type PropertyFormErrors,
  type PropertyFormValues,
} from "~/app/_lib/property-form";
import { listingTypeLabel, propertyTypeLabel } from "~/app/_lib/listing-text";
import {
  listingTypeSchema,
  propertyTypeSchema,
} from "~/lib/validators/property";

type Props = {
  values: PropertyFormValues;
  errors?: PropertyFormErrors;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-emerald-700 focus:outline-none aria-invalid:border-red-500";

/**
 * The fields of a listing (US-17.F1), grouped in sections. Only the fields: the page that uses
 * it puts the `<form>`, the submit button and what happens on submit around it, so the edit page
 * (US-19) can reuse it with the listing's values. Field names match `createPropertySchema`
 * except the price, typed in euros (`price`) and sent in cents (`priceCents`).
 */
export function PropertyFormFields({ values, errors = {} }: Props) {
  return (
    <div className="space-y-8">
      <Section title="Basics">
        <Field
          label="Title"
          name="title"
          maxLength={120}
          hint="5-120 characters, e.g. Bright flat near the beach"
          defaultValue={values.title}
          errors={errors.title}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Operation"
            name="listingType"
            placeholder="Sale or rent"
            options={listingTypeSchema.options.map((value) => ({
              value,
              label: listingTypeLabel(value),
            }))}
            defaultValue={values.listingType}
            errors={errors.listingType}
          />
          <Select
            label="Type of property"
            name="propertyType"
            placeholder="Choose a type"
            options={propertyTypeSchema.options.map((value) => ({
              value,
              label: propertyTypeLabel(value),
            }))}
            defaultValue={values.propertyType}
            errors={errors.propertyType}
          />
        </div>
        <Field
          label="Price (€)"
          name="price"
          inputMode="numeric"
          maxLength={15}
          hint="Whole euros. For rentals, the monthly rent."
          defaultValue={values.price}
          errors={errors.price}
        />
      </Section>

      <Section title="Features">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Area (m²) (optional)"
            name="areaM2"
            inputMode="numeric"
            maxLength={10}
            defaultValue={values.areaM2}
            errors={errors.areaM2}
          />
          <Field
            label="Bedrooms (optional)"
            name="bedrooms"
            inputMode="numeric"
            maxLength={10}
            defaultValue={values.bedrooms}
            errors={errors.bedrooms}
          />
          <Field
            label="Bathrooms (optional)"
            name="bathrooms"
            inputMode="numeric"
            maxLength={10}
            defaultValue={values.bathrooms}
            errors={errors.bathrooms}
          />
        </div>
        <Field
          label="Floor (optional)"
          name="floor"
          maxLength={20}
          hint="e.g. 3rd, Ground floor, Penthouse"
          defaultValue={values.floor}
          errors={errors.floor}
        />
        <fieldset>
          <legend className="text-sm font-medium">Extras</legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              label="Elevator"
              name="hasElevator"
              defaultChecked={values.hasElevator}
            />
            <Checkbox
              label="Parking"
              name="hasParking"
              defaultChecked={values.hasParking}
            />
            <Checkbox
              label="Furnished"
              name="isFurnished"
              defaultChecked={values.isFurnished}
            />
          </div>
        </fieldset>
      </Section>

      <Section title="Location">
        <Field
          label="Address"
          name="address"
          autoComplete="street-address"
          maxLength={200}
          hint="Street and number, e.g. Carrer de Mallorca 120"
          defaultValue={values.address}
          errors={errors.address}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="City"
            name="city"
            autoComplete="address-level2"
            maxLength={100}
            defaultValue={values.city}
            errors={errors.city}
          />
          <Field
            label="Neighbourhood (optional)"
            name="neighborhood"
            maxLength={100}
            defaultValue={values.neighborhood}
            errors={errors.neighborhood}
          />
          <Field
            label="Province"
            name="province"
            autoComplete="address-level1"
            maxLength={100}
            defaultValue={values.province}
            errors={errors.province}
          />
          <Field
            label="Postal code (optional)"
            name="postalCode"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={20}
            defaultValue={values.postalCode}
            errors={errors.postalCode}
          />
        </div>
      </Section>

      <Section title="Description">
        <TextArea
          label="Description"
          name="description"
          maxLength={5000}
          hint="20-5000 characters. What makes this home special?"
          defaultValue={values.description}
          errors={errors.description}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-2 text-lg font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

type SelectProps = {
  label: string;
  name: string;
  placeholder: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  errors?: string[];
};

function Select({
  label,
  name,
  placeholder,
  options,
  defaultValue,
  errors,
}: SelectProps) {
  const hasError = !!errors?.length;
  const errorId = `${name}-error`;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={inputClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasError && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

type TextAreaProps = {
  label: string;
  name: string;
  maxLength: number;
  hint: string;
  defaultValue: string;
  errors?: string[];
};

function TextArea({
  label,
  name,
  maxLength,
  hint,
  defaultValue,
  errors,
}: TextAreaProps) {
  const hasError = !!errors?.length;
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={6}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : hintId}
        className={inputClass}
      />
      {hasError ? (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {errors[0]}
        </p>
      ) : (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-emerald-700"
      />
      {label}
    </label>
  );
}
