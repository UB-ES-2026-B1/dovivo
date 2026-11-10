import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaller } from "~/server/api/root";
import { propertyDetailSelect } from "~/server/services/property-detail";

/**
 * Unit tests for the property router. Prisma is replaced by a small fake so no database is needed;
 * we assert on the query arguments the router builds and on how it handles the rows returned.
 */

const fakeDb = {
  property: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const ownerSession: Session = {
  user: { id: "owner_1", role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const otherSession: Session = {
  user: { id: "user_2", role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const makeCaller = (session: Session | null) =>
  createCaller({
    // The router only touches `db.property`, so a narrow fake is enough. Cast through `unknown`
    // because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as PrismaClient,
    session,
    clientIp: null,
    headers: new Headers(),
  });

const baseProperty = {
  id: "prop_1",
  ownerId: "owner_1",
  status: "PUBLISHED",
  deletedAt: null,
  images: [],
  owner: { id: "owner_1", name: "Owner", image: null },
};

beforeEach(() => {
  vi.resetAllMocks();
  // The timing middleware logs every call; keep the test output clean.
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("property.byId", () => {
  it("returns NOT_FOUND when the listing does not exist", async () => {
    fakeDb.property.findUnique.mockResolvedValue(null);

    await expect(
      makeCaller(null).property.byId({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND for a soft-deleted listing, even for its owner", async () => {
    fakeDb.property.findUnique.mockResolvedValue({
      ...baseProperty,
      deletedAt: new Date(),
    });

    await expect(
      makeCaller(ownerSession).property.byId({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      makeCaller(null).property.byId({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns a draft only to its owner", async () => {
    fakeDb.property.findUnique.mockResolvedValue({
      ...baseProperty,
      status: "DRAFT",
    });

    await expect(
      makeCaller(ownerSession).property.byId({ id: "prop_1" }),
    ).resolves.toMatchObject({ id: "prop_1", status: "DRAFT" });
    await expect(
      makeCaller(otherSession).property.byId({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      makeCaller(null).property.byId({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is public for published, reserved and closed listings", async () => {
    for (const status of ["PUBLISHED", "RESERVED", "CLOSED"]) {
      fakeDb.property.findUnique.mockResolvedValue({ ...baseProperty, status });

      await expect(
        makeCaller(null).property.byId({ id: "prop_1" }),
      ).resolves.toMatchObject({ id: "prop_1", status });
    }
  });

  it("queries with the public detail select", async () => {
    fakeDb.property.findUnique.mockResolvedValue(baseProperty);

    await makeCaller(null).property.byId({ id: "prop_1" });

    expect(fakeDb.property.findUnique).toHaveBeenCalledWith({
      where: { id: "prop_1" },
      select: propertyDetailSelect,
    });
  });

  it("does not return deletedAt", async () => {
    fakeDb.property.findUnique.mockResolvedValue(baseProperty);

    const property = await makeCaller(null).property.byId({ id: "prop_1" });

    expect(property).not.toHaveProperty("deletedAt");
  });

  it("rejects an empty or oversized id before querying", async () => {
    for (const id of ["", "   ", "x".repeat(51)]) {
      await expect(
        makeCaller(null).property.byId({ id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(fakeDb.property.findUnique).not.toHaveBeenCalled();
  });
});

describe("property.publish", () => {
  it("publishes a draft atomically, scoped to its owner", async () => {
    fakeDb.property.updateMany.mockResolvedValue({ count: 1 });
    fakeDb.property.findUniqueOrThrow.mockResolvedValue(baseProperty);

    await expect(
      makeCaller(ownerSession).property.publish({ id: "prop_1" }),
    ).resolves.toEqual(baseProperty);

    expect(fakeDb.property.updateMany).toHaveBeenCalledWith({
      where: {
        id: "prop_1",
        ownerId: "owner_1",
        deletedAt: null,
        status: "DRAFT",
      },
      data: { status: "PUBLISHED", publishedAt: expect.any(Date) as Date },
    });
  });

  it("returns NOT_FOUND for a soft-deleted listing", async () => {
    fakeDb.property.updateMany.mockResolvedValue({ count: 0 });
    fakeDb.property.findUnique.mockResolvedValue({
      ownerId: "owner_1",
      deletedAt: new Date(),
    });

    await expect(
      makeCaller(ownerSession).property.publish({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns FORBIDDEN when the listing belongs to someone else", async () => {
    fakeDb.property.updateMany.mockResolvedValue({ count: 0 });
    fakeDb.property.findUnique.mockResolvedValue({
      ownerId: "other_user",
      deletedAt: null,
    });

    await expect(
      makeCaller(ownerSession).property.publish({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns CONFLICT when the listing is not a draft", async () => {
    fakeDb.property.updateMany.mockResolvedValue({ count: 0 });
    fakeDb.property.findUnique.mockResolvedValue({
      ownerId: "owner_1",
      deletedAt: null,
    });

    await expect(
      makeCaller(ownerSession).property.publish({ id: "prop_1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fakeDb.property.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("protectedProcedure", () => {
  it("returns UNAUTHORIZED without a session", async () => {
    await expect(makeCaller(null).property.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fakeDb.property.findMany).not.toHaveBeenCalled();
  });
});

describe("property.mine", () => {
  it("excludes soft-deleted listings", async () => {
    fakeDb.property.findMany.mockResolvedValue([]);

    await makeCaller(ownerSession).property.mine();

    expect(fakeDb.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "owner_1", deletedAt: null },
      }),
    );
  });
});

describe("property.list", () => {
  it("is public and returns cards with a cover instead of the image list", async () => {
    fakeDb.property.findMany.mockResolvedValue([
      {
        id: "prop_1",
        title: "Casa amb jardí",
        listingType: "SALE",
        propertyType: "HOUSE",
        priceCents: 30_000_000,
        currency: "EUR",
        areaM2: 120,
        bedrooms: 4,
        neighborhood: null,
        city: "Lleida",
        province: "Lleida",
        images: [],
      },
    ]);

    const page = await makeCaller(null).property.list({ listingType: "SALE" });

    expect(page.nextCursor).toBeUndefined();
    expect(page.items).toEqual([
      expect.objectContaining({ id: "prop_1", cover: null }),
    ]);
    // The query itself is covered by src/server/services/property-list.test.ts.
  });
});
