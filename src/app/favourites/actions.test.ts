import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { add, remove, redirect } = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  // Like Next's `redirect`, it throws so the action stops there.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("~/trpc/server", () => ({ api: { favourite: { add, remove } } }));
vi.mock("next/navigation", () => ({ redirect }));

const { toggleFavouriteAction } = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toggleFavouriteAction (no-JS heart)", () => {
  it("saves the listing and reloads the page the user was on", async () => {
    add.mockResolvedValue({ propertyId: "p1", isFavourite: true });

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "p1", intent: "save", returnTo: "/rent" }),
      ),
    ).rejects.toThrow("REDIRECT /rent");
    expect(add).toHaveBeenCalledWith({ propertyId: "p1" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the listing", async () => {
    remove.mockResolvedValue({ propertyId: "p1", isFavourite: false });

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "p1", intent: "remove", returnTo: "/favourites" }),
      ),
    ).rejects.toThrow("REDIRECT /favourites");
    expect(remove).toHaveBeenCalledWith({ propertyId: "p1" });
    expect(add).not.toHaveBeenCalled();
  });

  it("sends a user without a session to the login and back", async () => {
    add.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED" }));

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "p1", intent: "save", returnTo: "/properties/p1" }),
      ),
    ).rejects.toThrow("REDIRECT /login?callbackUrl=%2Fproperties%2Fp1");
  });

  it("just reloads the page when the listing no longer exists", async () => {
    add.mockRejectedValue(new TRPCError({ code: "NOT_FOUND" }));

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "gone", intent: "save", returnTo: "/buy" }),
      ),
    ).rejects.toThrow("REDIRECT /buy");
  });

  it("calls nothing with a broken form, and goes back", async () => {
    await expect(
      toggleFavouriteAction(form({ intent: "save", returnTo: "/buy" })),
    ).rejects.toThrow("REDIRECT /buy");
    await expect(
      toggleFavouriteAction(form({ propertyId: "p1", returnTo: "/buy" })),
    ).rejects.toThrow("REDIRECT /buy");
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("never redirects to another site", async () => {
    add.mockResolvedValue({ propertyId: "p1", isFavourite: true });

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "p1", intent: "save", returnTo: "//evil.com" }),
      ),
    ).rejects.toThrow("REDIRECT /");
  });

  it("lets unexpected errors through (error page) instead of hiding them", async () => {
    add.mockRejectedValue(new Error("db down"));

    await expect(
      toggleFavouriteAction(
        form({ propertyId: "p1", intent: "save", returnTo: "/buy" }),
      ),
    ).rejects.toThrow("db down");
  });
});
