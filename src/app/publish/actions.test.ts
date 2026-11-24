import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { initialPublishFormState } from "~/app/publish/form-state";

const { create, redirect } = vi.hoisted(() => ({
  create: vi.fn(),
  // Like Next's `redirect`, it throws so the action stops there.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("~/trpc/server", () => ({ api: { property: { create } } }));
vi.mock("next/navigation", () => ({ redirect }));

const { createListing } = await import("./actions");

function validForm(extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields = {
    title: "Bright flat near the beach",
    listingType: "RENT",
    propertyType: "APARTMENT",
    price: "1200",
    address: "Carrer de Mallorca 120",
    city: "Barcelona",
    province: "Barcelona",
    description: "A bright flat with a balcony, close to the beach.",
    ...extra,
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createListing", () => {
  it("saves the draft and opens the photos step", async () => {
    create.mockResolvedValue({ id: "p1" });

    await expect(
      createListing(initialPublishFormState, validForm()),
    ).rejects.toThrow("REDIRECT /publish/p1/photos");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ priceCents: 120_000, listingType: "RENT" }),
    );
  });

  it("calls nothing when a field is wrong, and keeps what was typed", async () => {
    const state = await createListing(
      initialPublishFormState,
      validForm({ price: "", title: "Flat" }),
    );

    expect(create).not.toHaveBeenCalled();
    expect(state.fieldErrors).toHaveProperty("price");
    expect(state.fieldErrors).toHaveProperty("title");
    expect(state.values.title).toBe("Flat");
  });

  it("goes to the login when the session has expired", async () => {
    create.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED" }));

    await expect(
      createListing(initialPublishFormState, validForm()),
    ).rejects.toThrow("REDIRECT /login?callbackUrl=/publish");
  });

  it("shows the server's field errors if the schemas ever drift apart", async () => {
    const cause = new ZodError([
      {
        code: "custom",
        path: ["title"],
        message: "Title is too long",
      },
    ]);
    create.mockRejectedValue(new TRPCError({ code: "BAD_REQUEST", cause }));

    const state = await createListing(initialPublishFormState, validForm());

    expect(state.fieldErrors?.title).toEqual(["Title is too long"]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows a general error when saving fails, keeping the values", async () => {
    create.mockRejectedValue(new Error("db down"));

    const state = await createListing(initialPublishFormState, validForm());

    expect(state.formError).toMatch(/something went wrong/i);
    expect(state.values.title).toBe("Bright flat near the beach");
    expect(redirect).not.toHaveBeenCalled();
  });
});
