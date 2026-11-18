import { describe, expect, it } from "vitest";

import {
  type PropertyCardRow,
  toPropertyCard,
  withPhotoUrls,
} from "./property-card";

const row: PropertyCardRow = {
  id: "prop_1",
  title: "Pis lluminós a Gràcia",
  listingType: "RENT",
  propertyType: "APARTMENT",
  priceCents: 125_000,
  currency: "EUR",
  areaM2: 70,
  bedrooms: 2,
  neighborhood: "Gràcia",
  city: "Barcelona",
  province: "Barcelona",
  images: [],
};

const cover = {
  url: "https://img.example/cover.jpg",
  thumbnailUrl: "https://img.example/cover-thumb.jpg",
  alt: "Menjador",
  width: 1200,
  height: 800,
};

describe("toPropertyCard", () => {
  it("keeps the card fields and exposes the first image as the cover", () => {
    const card = toPropertyCard({ ...row, images: [cover] });

    expect(card).toMatchObject({
      id: "prop_1",
      priceCents: 125_000,
      areaM2: 70,
      bedrooms: 2,
      neighborhood: "Gràcia",
      city: "Barcelona",
      cover,
    });
    expect(card).not.toHaveProperty("images");
  });

  it("returns a null cover for a listing without photos", () => {
    const card = toPropertyCard(row);

    expect(card.cover).toBeNull();
    expect(card).not.toHaveProperty("images");
  });
});

describe("withPhotoUrls", () => {
  const base = "https://photos.dovivo.test";

  it("turns stored keys into public URLs (US-18)", () => {
    expect(
      withPhotoUrls(
        {
          url: "properties/p/a.jpg",
          thumbnailUrl: "properties/p/a-thumb.webp",
          alt: null,
        },
        base,
      ),
    ).toEqual({
      url: "https://photos.dovivo.test/properties/p/a.jpg",
      thumbnailUrl: "https://photos.dovivo.test/properties/p/a-thumb.webp",
      alt: null,
    });
  });

  it("keeps full URLs and a missing thumbnail", () => {
    const seed = {
      url: "https://picsum.photos/seed/x/1200/800",
      thumbnailUrl: null,
    };
    expect(withPhotoUrls(seed, base)).toEqual(seed);
  });
});
