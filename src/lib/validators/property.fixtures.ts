import { type CreatePropertyInput } from "./property";

/**
 * Test fixture shared by the validator and router tests: a listing with only the required fields
 * of `createPropertySchema`, already in the shape the schema returns (trimmed, no empty strings).
 * Update it here when a required field changes.
 */
export const validListing = {
  title: "Pis lluminós a Gràcia",
  description: "Pis de 80 m² amb balcó, molt a prop del metro i de botigues.",
  listingType: "RENT",
  propertyType: "APARTMENT",
  priceCents: 120_000,
  address: "Carrer de Verdi, 10",
  city: "Barcelona",
  province: "Barcelona",
} satisfies CreatePropertyInput;
