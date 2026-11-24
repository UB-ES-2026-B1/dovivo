import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { favouriteListSchema } from "~/lib/validators/favourite";

import {
  addFavourite,
  favouriteAvailability,
  type FavouritesDb,
  listFavouriteIds,
  listFavourites,
  removeFavourite,
} from "./favourites";

/**
 * Unit tests for favourites (US-14). Prisma is replaced by a small fake: we assert on the query
 * arguments the service builds and on how it maps and pages the rows returned.
 */

const fakeDb = {
  property: { findUnique: vi.fn() },
  favourite: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
};
// Cast through `unknown` because Prisma's delegate methods are heavily generic.
const db = fakeDb as unknown as FavouritesDb;

const USER = "user_1";

const listing = (
  override: Partial<{
    status: string;
    deletedAt: Date | null;
    ownerId: string;
  }> = {},
) => ({
  status: "PUBLISHED",
  deletedAt: null,
  ownerId: "owner_1",
  ...override,
});

const savedAt = new Date("2026-11-20T10:00:00Z");

/** A row as `listFavourites` selects it. */
const favouriteRow = (
  id: string,
  override: Partial<{ status: string; deletedAt: Date | null }> = {},
) => ({
  createdAt: savedAt,
  property: {
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
    images: [] as {
      url: string;
      thumbnailUrl: string | null;
      alt: string | null;
      width: number | null;
      height: number | null;
    }[],
    status: "PUBLISHED",
    deletedAt: null,
    ...override,
  },
});

/** Runs the input through the zod schema first, as the router does (defaults included). */
const list = (input: Record<string, unknown> = {}) =>
  listFavourites(db, USER, favouriteListSchema.parse(input));

beforeEach(() => {
  vi.resetAllMocks();
  fakeDb.property.findUnique.mockResolvedValue(listing());
  fakeDb.favourite.createMany.mockResolvedValue({ count: 1 });
  fakeDb.favourite.deleteMany.mockResolvedValue({ count: 1 });
  fakeDb.favourite.findMany.mockResolvedValue([]);
});

describe("favouriteAvailability", () => {
  it.each([
    ["published", { status: "PUBLISHED", deletedAt: null }, "AVAILABLE"],
    ["reserved", { status: "RESERVED", deletedAt: null }, "RESERVED"],
    [
      "closed (sold or rented)",
      { status: "CLOSED", deletedAt: null },
      "CLOSED",
    ],
    ["back to draft", { status: "DRAFT", deletedAt: null }, "UNAVAILABLE"],
    ["deleted", { status: "PUBLISHED", deletedAt: new Date() }, "UNAVAILABLE"],
    [
      "deleted while reserved",
      { status: "RESERVED", deletedAt: new Date() },
      "UNAVAILABLE",
    ],
    // A status added later (e.g. BLOCKED for moderation) must not show as available.
    [
      "an unknown status",
      { status: "BLOCKED", deletedAt: null },
      "UNAVAILABLE",
    ],
  ] as const)("%s → %s", (_case, property, expected) => {
    expect(
      favouriteAvailability(
        property as Parameters<typeof favouriteAvailability>[0],
      ),
    ).toBe(expected);
  });
});

describe("addFavourite", () => {
  it("saves the listing for the user, ignoring a duplicate", async () => {
    await expect(addFavourite(db, USER, "prop_1")).resolves.toEqual({
      propertyId: "prop_1",
      isFavourite: true,
    });

    expect(fakeDb.property.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prop_1" } }),
    );
    expect(fakeDb.favourite.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER, propertyId: "prop_1" }],
      skipDuplicates: true,
    });
  });

  it("is idempotent: saving it again succeeds without inserting", async () => {
    fakeDb.favourite.createMany.mockResolvedValue({ count: 0 });

    await expect(addFavourite(db, USER, "prop_1")).resolves.toEqual({
      propertyId: "prop_1",
      isFavourite: true,
    });
  });

  it.each([
    ["reserved", listing({ status: "RESERVED" })],
    ["closed", listing({ status: "CLOSED" })],
    ["the user's own draft", listing({ status: "DRAFT", ownerId: USER })],
  ])("saves a %s listing (the user can open it)", async (_case, row) => {
    fakeDb.property.findUnique.mockResolvedValue(row);

    await addFavourite(db, USER, "prop_1");
    expect(fakeDb.favourite.createMany).toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["deleted", listing({ deletedAt: new Date() })],
    ["someone else's draft", listing({ status: "DRAFT" })],
  ])("NOT_FOUND for a %s listing, without saving", async (_case, row) => {
    fakeDb.property.findUnique.mockResolvedValue(row);

    await expect(addFavourite(db, USER, "prop_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(fakeDb.favourite.createMany).not.toHaveBeenCalled();
  });

  it("NOT_FOUND if the listing is hard-deleted between the check and the insert", async () => {
    fakeDb.favourite.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint", {
        code: "P2003",
        clientVersion: "6",
      }),
    );

    await expect(addFavourite(db, USER, "prop_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets other database errors through", async () => {
    const error = new Error("connection lost");
    fakeDb.favourite.createMany.mockRejectedValue(error);

    await expect(addFavourite(db, USER, "prop_1")).rejects.toBe(error);
  });
});

describe("removeFavourite", () => {
  it("removes only the user's favourite, without checking the listing", async () => {
    await expect(removeFavourite(db, USER, "prop_1")).resolves.toEqual({
      propertyId: "prop_1",
      isFavourite: false,
    });

    expect(fakeDb.favourite.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, propertyId: "prop_1" },
    });
    // Deleted or unavailable listings must still be removable.
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
  });

  it("is idempotent: removing one that isn't saved succeeds", async () => {
    fakeDb.favourite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(removeFavourite(db, USER, "prop_1")).resolves.toEqual({
      propertyId: "prop_1",
      isFavourite: false,
    });
  });
});

describe("listFavourites", () => {
  it("reads only the user's favourites, newest saved first", async () => {
    await list();

    expect(fakeDb.favourite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        orderBy: [{ createdAt: "desc" }, { propertyId: "desc" }],
        take: 21,
        cursor: undefined,
      }),
    );
  });

  it("doesn't filter out unavailable listings in the query", async () => {
    await list();

    const [args] = fakeDb.favourite.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ userId: USER });
  });

  it("continues from the cursor (a listing id) on the user's own favourites", async () => {
    await list({ cursor: "prop_9", limit: 5 });

    expect(fakeDb.favourite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 6,
        cursor: { userId_propertyId: { userId: USER, propertyId: "prop_9" } },
      }),
    );
  });

  it("returns cards with availability and the date saved, never status or deletedAt", async () => {
    fakeDb.favourite.findMany.mockResolvedValue([
      favouriteRow("prop_1"),
      favouriteRow("prop_2", { deletedAt: new Date() }),
      favouriteRow("prop_3", { status: "CLOSED" }),
    ]);

    const { items, nextCursor } = await list();

    expect(nextCursor).toBeUndefined();
    expect(items.map((item) => [item.id, item.availability])).toEqual([
      ["prop_1", "AVAILABLE"],
      ["prop_2", "UNAVAILABLE"],
      ["prop_3", "CLOSED"],
    ]);
    expect(items[0]).toMatchObject({
      title: "Listing prop_1",
      priceCents: 25_000_000,
      cover: null,
      savedAt,
    });
    for (const item of items) {
      expect(item).not.toHaveProperty("status");
      expect(item).not.toHaveProperty("deletedAt");
      expect(item).not.toHaveProperty("images");
    }
  });

  it("returns the cover photo with its public URL", async () => {
    const row = favouriteRow("prop_1");
    row.property.images = [
      {
        url: "https://picsum.photos/seed/a/1200/800",
        thumbnailUrl: null,
        alt: "Sala",
        width: 1200,
        height: 800,
      },
    ];
    fakeDb.favourite.findMany.mockResolvedValue([row]);

    const { items } = await list();
    expect(items[0]?.cover).toMatchObject({
      url: "https://picsum.photos/seed/a/1200/800",
      alt: "Sala",
    });
  });

  it("gives the extra row's id as nextCursor and leaves it out of the page", async () => {
    fakeDb.favourite.findMany.mockResolvedValue([
      favouriteRow("prop_3"),
      favouriteRow("prop_2"),
      favouriteRow("prop_1"),
    ]);

    const { items, nextCursor } = await list({ limit: 2 });

    expect(items.map((item) => item.id)).toEqual(["prop_3", "prop_2"]);
    expect(nextCursor).toBe("prop_1");
  });
});

describe("listFavouriteIds", () => {
  it("returns the ids of every saved listing of the user", async () => {
    fakeDb.favourite.findMany.mockResolvedValue([
      { propertyId: "prop_2" },
      { propertyId: "prop_1" },
    ]);

    await expect(listFavouriteIds(db, USER)).resolves.toEqual([
      "prop_2",
      "prop_1",
    ]);
    expect(fakeDb.favourite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        select: { propertyId: true },
      }),
    );
  });
});
