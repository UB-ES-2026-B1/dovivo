import {
  createPropertySchema,
  DB_INT_MAX,
  type CreatePropertyInput,
} from "~/lib/validators/property";

/**
 * What the listing form shows, as typed by the user: text fields as strings and the extras as
 * booleans. Kept separate from `CreatePropertyInput` so a failed submit can show the form again
 * exactly as it was (e.g. "250.000" in the price, not 25000000 cents).
 */
export type PropertyFormValues = {
  title: string;
  listingType: string;
  propertyType: string;
  price: string;
  areaM2: string;
  bedrooms: string;
  bathrooms: string;
  floor: string;
  address: string;
  neighborhood: string;
  city: string;
  province: string;
  postalCode: string;
  description: string;
  hasElevator: boolean;
  hasParking: boolean;
  isFurnished: boolean;
};

export type PropertyFormField = keyof PropertyFormValues;
export type PropertyFormErrors = Partial<Record<PropertyFormField, string[]>>;

const TEXT_FIELDS = [
  "title",
  "listingType",
  "propertyType",
  "price",
  "areaM2",
  "bedrooms",
  "bathrooms",
  "floor",
  "address",
  "neighborhood",
  "city",
  "province",
  "postalCode",
  "description",
] as const satisfies readonly PropertyFormField[];

const CHECKBOX_FIELDS = [
  "hasElevator",
  "hasParking",
  "isFurnished",
] as const satisfies readonly PropertyFormField[];

/** An empty form, for the publish page. US-19 (edit) can start from the listing instead. */
export const emptyPropertyFormValues: PropertyFormValues = {
  title: "",
  listingType: "",
  propertyType: "",
  price: "",
  areaM2: "",
  bedrooms: "",
  bathrooms: "",
  floor: "",
  address: "",
  neighborhood: "",
  city: "",
  province: "",
  postalCode: "",
  description: "",
  hasElevator: false,
  hasParking: false,
  isFurnished: false,
};

/** The most the price field accepts, in whole euros (`priceCents` is a Postgres `integer`). */
export const MAX_PRICE_EUROS = Math.floor(DB_INT_MAX / 100);

const PRICE_FORMAT_ERROR = "Enter the price in whole euros, e.g. 250000";
const PRICE_TOO_HIGH_ERROR = `The price can be at most ${MAX_PRICE_EUROS.toLocaleString("en")} €`;
const REQUIRED_ERROR = "This field is required";
const REQUIRED_TEXT_FIELDS = [
  "title",
  "price",
  "address",
  "city",
  "province",
  "description",
] as const satisfies readonly PropertyFormField[];
const WHOLE_NUMBER_ERROR = "Enter a whole number, e.g. 3";

type Parsed =
  { ok: true; value: number | undefined } | { ok: false; error: string };

/**
 * Price in whole euros, as people type it: "250000", "250 000" or "250.000" (dots as thousands
 * separators, as in Spain). Decimals are refused instead of guessed: "1.5" could mean 1.5 € or
 * 1,500 €. Empty gives `undefined`, so the schema answers "Required".
 */
export function parseEuros(text: string): Parsed {
  const compact = text.replace(/\s/g, "");
  if (compact === "") return { ok: true, value: undefined };

  let digits: string;
  if (/^\d+$/.test(compact)) digits = compact;
  else if (/^\d{1,3}(\.\d{3})+$/.test(compact))
    digits = compact.replace(/\./g, "");
  else return { ok: false, error: PRICE_FORMAT_ERROR };

  const euros = Number(digits);
  if (euros > MAX_PRICE_EUROS)
    return { ok: false, error: PRICE_TOO_HIGH_ERROR };
  return { ok: true, value: euros * 100 };
}

/** Optional whole number (m², bedrooms, bathrooms). Empty gives `undefined` ("not given"). */
export function parseWholeNumber(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: WHOLE_NUMBER_ERROR };
  // Very long numbers become huge (or Infinity): the schema then answers with its own maximum.
  return { ok: true, value: Number(trimmed) };
}

/** The friendlier message for the two selects, instead of zod's "Invalid enum value…". */
const CHOOSE_ONE: Partial<Record<PropertyFormField, string>> = {
  listingType: "Choose sale or rent",
  propertyType: "Choose the type of property",
};

/**
 * Turns `property.create` errors (keyed by the API field names) into form errors (keyed by the
 * form fields): only the price is named differently.
 */
export function toFormErrors(
  apiErrors: Partial<Record<string, string[] | undefined>>,
): PropertyFormErrors {
  const errors: PropertyFormErrors = {};
  for (const [key, messages] of Object.entries(apiErrors)) {
    if (!messages?.length) continue;
    const field = (key === "priceCents" ? "price" : key) as PropertyFormField;
    if (
      key === "priceCents" &&
      messages.some((m) => m.includes("less than or equal"))
    ) {
      errors.price = [PRICE_TOO_HIGH_ERROR];
      continue;
    }
    const friendly = CHOOSE_ONE[field];
    errors[field] = friendly ? [friendly] : messages;
  }
  return errors;
}

export type ReadPropertyFormResult =
  | {
      values: PropertyFormValues;
      input: CreatePropertyInput;
      fieldErrors?: undefined;
    }
  | {
      values: PropertyFormValues;
      input?: undefined;
      fieldErrors: PropertyFormErrors;
    };

/**
 * Reads the listing form (US-17.F1) and validates it with the same schema as `property.create`,
 * so the errors match the server's and nothing is sent while a field is wrong. Returns the values
 * as typed (to show the form again) and, when everything is valid, the input for the API.
 */
export function readPropertyForm(form: FormData): ReadPropertyFormResult {
  const values = { ...emptyPropertyFormValues };
  for (const field of TEXT_FIELDS) {
    const value = form.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  for (const field of CHECKBOX_FIELDS) {
    values[field] = form.get(field) === "on";
  }

  const parseErrors: PropertyFormErrors = {};
  const numberOf = (field: PropertyFormField, parsed: Parsed) => {
    if (parsed.ok) return parsed.value;
    parseErrors[field] = [parsed.error];
    return undefined;
  };

  const input = {
    title: values.title,
    description: values.description,
    // `undefined` when nothing is chosen, so the schema answers "Required" (then "Choose…").
    listingType: values.listingType || undefined,
    propertyType: values.propertyType || undefined,
    priceCents: numberOf("price", parseEuros(values.price)),
    bedrooms: numberOf("bedrooms", parseWholeNumber(values.bedrooms)),
    bathrooms: numberOf("bathrooms", parseWholeNumber(values.bathrooms)),
    areaM2: numberOf("areaM2", parseWholeNumber(values.areaM2)),
    floor: values.floor,
    address: values.address,
    neighborhood: values.neighborhood,
    city: values.city,
    province: values.province,
    postalCode: values.postalCode,
    hasElevator: values.hasElevator,
    hasParking: values.hasParking,
    isFurnished: values.isFurnished,
  };

  const parsed = createPropertySchema.safeParse(input);
  if (parsed.success && Object.keys(parseErrors).length === 0) {
    // The input as typed (before the schema's transforms): the server validates it again.
    return { values, input: input as CreatePropertyInput };
  }

  const fieldErrors: PropertyFormErrors = {
    ...(parsed.success ? {} : toFormErrors(parsed.error.flatten().fieldErrors)),
    // A number that couldn't be read says why, instead of the schema's "Required".
    ...parseErrors,
  };
  // An empty required field says so, instead of "String must contain at least 5 character(s)".
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (fieldErrors[field] && values[field].trim() === "") {
      fieldErrors[field] = [REQUIRED_ERROR];
    }
  }
  return { values, fieldErrors };
}
