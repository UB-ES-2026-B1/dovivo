import { describe, expect, it } from "vitest";

import {
  canViewPropertyDetail,
  propertyDetailSelect,
  type PropertyDetailRow,
  toPropertyDetail,
} from "./property-detail";

const row: PropertyDetailRow = {
  id: "prop_1",
  title: "Pis lluminós a Gràcia",
  description: "Pis exterior de 70 m² amb balcó i molta llum.",
  listingType: "RENT",
  propertyType: "APARTMENT",
  status: "PUBLISHED",
  priceCents: 125_000,
  currency: "EUR",
  bedrooms: 2,
  bathrooms: 1,
  areaM2: 70,
  floor: "3",
  address: "Carrer de Verdi, 10",
  neighborhood: "Gràcia",
  city: "Barcelona",
  province: "Barcelona",
  postalCode: "08012",
  country: "ES",
  latitude: 41.403,
  longitude: 2.157,
  hasElevator: true,
  hasParking: false,
  isFurnished: true,
  publishedAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-02T10:00:00Z"),
  images: [],
  owner: { id: "owner_1", name: "Anna", image: null },
  deletedAt: null,
};

describe("propertyDetailSelect", () => {
  it("shows what the detail page needs (US-12)", () => {
    for (const field of [
      "priceCents",
      "listingType",
      "areaM2",
      "bedrooms",
      "bathrooms",
      "description",
      "address",
      "city",
    ] as const) {
      expect(propertyDetailSelect[field]).toBe(true);
    }
    expect(propertyDetailSelect.images.orderBy).toEqual({ position: "asc" });
  });

  it("never selects internal columns or the owner's contact data", () => {
    expect(propertyDetailSelect).not.toHaveProperty("ownerId");
    expect(propertyDetailSelect).not.toHaveProperty("createdAt");
    expect(propertyDetailSelect.owner.select).toEqual({
      id: true,
      name: true,
      image: true,
    });
    expect(propertyDetailSelect.images.select).not.toHaveProperty("mimeType");
    expect(propertyDetailSelect.images.select).not.toHaveProperty("sizeBytes");
  });
});

describe("canViewPropertyDetail", () => {
  it("hides soft-deleted listings from everyone, including the owner", () => {
    const deleted = { ...row, deletedAt: new Date() };
    expect(canViewPropertyDetail(deleted, "owner_1")).toBe(false);
    expect(canViewPropertyDetail(deleted, undefined)).toBe(false);
  });

  it("shows drafts only to their owner", () => {
    const draft = { ...row, status: "DRAFT" as const };
    expect(canViewPropertyDetail(draft, "owner_1")).toBe(true);
    expect(canViewPropertyDetail(draft, "user_2")).toBe(false);
    expect(canViewPropertyDetail(draft, undefined)).toBe(false);
  });

  it("shows published, reserved and closed listings to visitors", () => {
    for (const status of ["PUBLISHED", "RESERVED", "CLOSED"] as const) {
      expect(canViewPropertyDetail({ ...row, status }, undefined)).toBe(true);
    }
  });
});

describe("toPropertyDetail", () => {
  it("drops deletedAt and keeps everything else", () => {
    const detail = toPropertyDetail(row);

    expect(detail).not.toHaveProperty("deletedAt");
    expect(Object.keys(detail)).toHaveLength(Object.keys(row).length - 1);
    expect(detail).toMatchObject({ id: "prop_1", owner: row.owner });
  });
});
