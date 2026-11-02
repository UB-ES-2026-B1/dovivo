import { beforeEach, describe, expect, it, vi } from "vitest";

import { propertyFiltersSchema } from "~/lib/validators/property";

import { type PropertyCardRow } from "./property-card";
import { listPropertyCards, type PropertyListDb } from "./property-list";

/**
 * Unit tests for the public listing search. Prisma is replaced by a small fake: we assert on the
 * query arguments the service builds and on how it pages the rows returned.
 */

const fakeDb = { property: { findMany: vi.fn() } };
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
