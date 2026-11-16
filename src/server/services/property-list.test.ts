import { beforeEach, describe, expect, it, vi } from "vitest";

import { propertyFiltersSchema } from "~/lib/validators/property";

import { type PropertyCardRow } from "./property-card";
import { listPropertyCards, type PropertyListDb } from "./property-list";

/**
 * Unit tests for the public listing search. Prisma is replaced by a small fake: we assert on the
 * query arguments the service builds and on how it pages the rows returned.
 */

const fakeDb = { property: { findMany: vi.fn(), count: vi.fn() } };
// Cast through `unknown` because Prisma's delegate methods are heavily generic.
const db = fakeDb as unknown as PropertyListDb;

/** Runs the input through the zod schema first, as the router does (defaults included). */
const list = (input: Record<string, unknown> = {}) =>
  listPropertyCards(db, propertyFiltersSchema.parse(input));

const makeRow = (id: string): PropertyCardRow => ({
  id,
  title: `Listing ${id}`,
  listingType: "SALE",
  propertyType: "APARTMENT",
  priceCents: 25_000_000,
  currency: "EUR",
  areaM2: 80,
  bedrooms: 3,
  neighborhood: null,
  city: "Girona",
  province: "Girona",
  images: [],
});

beforeEach(() => {
  vi.resetAllMocks();
  fakeDb.property.findMany.mockResolvedValue([]);
  fakeDb.property.count.mockResolvedValue(0);
});

describe("listPropertyCards", () => {
  it("returns only published, not deleted listings, newest first", async () => {
    await list();

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          deletedAt: null,
        }) as unknown,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("filters by operation (sale or rent)", async () => {
    await list({ listingType: "RENT" });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ listingType: "RENT" }) as unknown,
      }),
    );
  });

  it("filters city and neighbourhood ignoring case and accents (US-10)", async () => {
    await list({
      city: "  SANT CUGAT del Vallès ",
      neighborhood: "Sant Martí",
    });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          citySearch: "sant cugat del valles",
          neighborhoodSearch: "sant marti",
        }) as unknown,
      }),
    );
  });

  it("filters by area range (US-10)", async () => {
    await list({ minAreaM2: 60, maxAreaM2: 120 });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          areaM2: { gte: 60, lte: 120 },
        }) as unknown,
      }),
    );
  });

  it("filters by a minimum area alone", async () => {
    await list({ minAreaM2: 60 });

    const [args] = fakeDb.property.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where.areaM2).toEqual({ gte: 60, lte: undefined });
  });

  it("does not filter by area when none is given, so listings without m² still show", async () => {
    await list();

    const [args] = fakeDb.property.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where.areaM2).toBeUndefined();
  });

  it("combines every filter in the same query (US-10)", async () => {
    await list({
      listingType: "RENT",
      propertyType: "APARTMENT",
      minPriceCents: 80_000,
      maxPriceCents: 150_000,
      minBedrooms: 2,
      minBathrooms: 1,
      minAreaM2: 50,
      maxAreaM2: 90,
      hasParking: true,
      city: "Barcelona",
      neighborhood: "Gràcia",
    });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          listingType: "RENT",
          propertyType: "APARTMENT",
          citySearch: "barcelona",
          neighborhoodSearch: "gracia",
          bedrooms: { gte: 2 },
          bathrooms: { gte: 1 },
          priceCents: { gte: 80_000, lte: 150_000 },
          areaM2: { gte: 50, lte: 90 },
          hasParking: true,
        },
      }),
    );
  });

  it("counts the whole search with the same filters, whatever the page (US-10)", async () => {
    fakeDb.property.findMany.mockResolvedValue(["p2", "p1"].map(makeRow));
    fakeDb.property.count.mockResolvedValue(42);

    const page = await list({ listingType: "RENT", limit: 1, cursor: "p2" });

    const [findArgs] = fakeDb.property.findMany.mock.calls[0] as [
      { where: unknown },
    ];
    // No cursor, take or select: a count of every matching listing, not of this page.
    expect(fakeDb.property.count).toHaveBeenCalledWith({
      where: findArgs.where,
    });
    expect(page.total).toBe(42);
  });

  it("returns a zero total when nothing matches", async () => {
    const page = await list({ city: "Enlloc" });

    expect(page).toEqual({ items: [], nextCursor: undefined, total: 0 });
  });

  it("filters by a minimum number of bathrooms, and not at all when none is given", async () => {
    await list({ minBathrooms: 2 });
    await list();

    const calls = fakeDb.property.findMany.mock.calls as [
      { where: Record<string, unknown> },
    ][];
    expect(calls[0]?.[0].where.bathrooms).toEqual({ gte: 2 });
    expect(calls[1]?.[0].where.bathrooms).toBeUndefined();
  });

  it.each([
    ["true", true, true],
    ["false (an unticked checkbox)", false, undefined],
    ["missing", undefined, undefined],
  ])(
    "with hasParking %s, filters by parking only when true",
    async (_label, hasParking, expected) => {
      await list({ hasParking });

      const [args] = fakeDb.property.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(args.where.hasParking).toBe(expected);
    },
  );

  it("does not filter by location when none is given", async () => {
    await list();

    const [args] = fakeDb.property.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where.citySearch).toBeUndefined();
    expect(args.where.neighborhoodSearch).toBeUndefined();
    expect(args.where).not.toHaveProperty("city");
  });

  it("selects only the card fields and the cover photo", async () => {
    await list();

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          title: true,
          listingType: true,
          propertyType: true,
          priceCents: true,
          currency: true,
          areaM2: true,
          bedrooms: true,
          neighborhood: true,
          city: true,
          province: true,
          images: {
            select: {
              url: true,
              thumbnailUrl: true,
              alt: true,
              width: true,
              height: true,
            },
            orderBy: [{ isCover: "desc" }, { position: "asc" }],
            take: 1,
          },
        },
      }),
    );
  });

  it("asks for one extra row and returns it as the next cursor", async () => {
    fakeDb.property.findMany.mockResolvedValue(["p3", "p2", "p1"].map(makeRow));

    const page = await list({ limit: 2 });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, cursor: undefined }),
    );
    expect(page.items.map((item) => item.id)).toEqual(["p3", "p2"]);
    expect(page.nextCursor).toBe("p1");
  });

  it("has no next cursor on the last page", async () => {
    fakeDb.property.findMany.mockResolvedValue(["p1"].map(makeRow));

    const page = await list({ limit: 2, cursor: "p1" });

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, cursor: { id: "p1" } }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeUndefined();
  });

  it("maps each row to a card with its cover", async () => {
    const cover = {
      url: "https://img.example/1.jpg",
      thumbnailUrl: null,
      alt: null,
      width: null,
      height: null,
    };
    fakeDb.property.findMany.mockResolvedValue([
      { ...makeRow("p1"), images: [cover] },
    ]);

    const { items } = await list();

    expect(items[0]?.cover).toEqual(cover);
    expect(items[0]).not.toHaveProperty("images");
  });
});
