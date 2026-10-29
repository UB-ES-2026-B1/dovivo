import { Prisma, type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCaller } from "~/server/api/root";

/**
 * Unit tests for the user router. Prisma is replaced by a small fake so no database is needed;
 * we assert on the query arguments the router builds and on how it handles the rows returned.
 */

const fakeDb = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const session: Session = {
  user: { id: "user_1", role: "USER" },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const makeCaller = (session: Session | null) =>
  createCaller({
    // The router only touches `db.user`, so a narrow fake is enough. Cast through `unknown`
    // because the fake does not implement the whole PrismaClient surface.
    db: fakeDb as unknown as PrismaClient,
    session,
    clientIp: null,
    headers: new Headers(),
  });

const profile = {
  id: "user_1",
  name: "Ana",
  email: "ana@example.com",
  emailVerified: null,
  phone: "+34600000000",
  image: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
};

// The only fields `me` and `updateMe` may return. Compared exactly, so adding a field fails.
const publicProfileSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  phone: true,
  image: true,
  createdAt: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  // The timing middleware logs every call; keep the test output clean.
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("user.me", () => {
  it("returns UNAUTHORIZED without a session and never queries the database", async () => {
    await expect(makeCaller(null).user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns the profile of the user in the session", async () => {
    fakeDb.user.findUnique.mockResolvedValue(profile);

    await expect(makeCaller(session).user.me()).resolves.toEqual(profile);
    expect(fakeDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_1" } }),
    );
  });

  // An exact match, so adding a field (e.g. passwordHash) to the select fails this test.
  it("selects only public profile fields", async () => {
    fakeDb.user.findUnique.mockResolvedValue(profile);

    await makeCaller(session).user.me();

    const [args] = fakeDb.user.findUnique.mock.calls[0] as [
      { select: Record<string, boolean> },
    ];
    expect(args.select).toEqual(publicProfileSelect);
  });

  it("returns UNAUTHORIZED when the account no longer exists", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);

    await expect(makeCaller(session).user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("user.updateMe", () => {
  const updateArgs = () =>
    fakeDb.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
      select: Record<string, boolean>;
    };

  it("returns UNAUTHORIZED without a session and never queries the database", async () => {
    await expect(
      makeCaller(null).user.updateMe({ name: "Ana" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("updates the name and phone of the user in the session and returns the profile", async () => {
    const updated = { ...profile, name: "Ana Pérez", phone: "+34611111111" };
    fakeDb.user.update.mockResolvedValue(updated);

    await expect(
      makeCaller(session).user.updateMe({
        name: "Ana Pérez",
        phone: "+34 611 11 11 11",
      }),
    ).resolves.toEqual(updated);
    expect(updateArgs()).toEqual({
      where: { id: "user_1" },
      data: { name: "Ana Pérez", phone: "+34611111111" },
      select: publicProfileSelect,
    });
  });

  it("leaves omitted fields unchanged", async () => {
    fakeDb.user.update.mockResolvedValue(profile);

    await makeCaller(session).user.updateMe({ phone: "600000000" });

    // Prisma skips `undefined` values, so the name is not touched.
    expect(updateArgs().data).toEqual({ name: undefined, phone: "600000000" });
  });

  it.each([
    ["an empty string", ""],
    ["null", null],
  ])("clears the phone with %s", async (_label, phone) => {
    fakeDb.user.update.mockResolvedValue({ ...profile, phone: null });

    await makeCaller(session).user.updateMe({ phone });

    expect(updateArgs().data.phone).toBeNull();
  });

  it("never writes fields that are not editable", async () => {
    fakeDb.user.update.mockResolvedValue(profile);

    // Not allowed by the input type; a hand-crafted request could still send them.
    const input = {
      name: "Ana",
      email: "other@example.com",
      role: "ADMIN",
      passwordHash: "x",
    } as { name: string };
    await makeCaller(session).user.updateMe(input);

    expect(updateArgs().data).toEqual({ name: "Ana", phone: undefined });
  });

  it.each([
    ["an invalid phone", { name: "Ana Pérez", phone: "abc" }],
    ["a too short name", { name: "A", phone: "600000000" }],
  ])("rejects %s with BAD_REQUEST and saves nothing", async (_label, input) => {
    await expect(
      makeCaller(session).user.updateMe(input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED when the account no longer exists", async () => {
    fakeDb.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(
      makeCaller(session).user.updateMe({ name: "Ana" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not hide other database errors", async () => {
    fakeDb.user.update.mockRejectedValue(new Error("connection lost"));

    await expect(
      makeCaller(session).user.updateMe({ name: "Ana" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
