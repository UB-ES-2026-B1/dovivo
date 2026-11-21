import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialPublishFormState } from "~/app/publish/form-state";

const { create, publish, redirect } = vi.hoisted(() => ({
  create: vi.fn(),
  publish: vi.fn(),
  // Like Next's `redirect`, it throws so the action stops there.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("~/trpc/server", () => ({ api: { property: { create, publish } } }));
vi.mock("next/navigation", () => ({ redirect }));

const { publishProperty } = await import("./actions");

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

describe("publishProperty", () => {
  it("creates the draft, publishes it and opens its page", async () => {
    create.mockResolvedValue({ id: "p1" });
    publish.mockResolvedValue({ id: "p1" });

    await expect(
      publishProperty(initialPublishFormState, validForm()),
    ).rejects.toThrow("REDIRECT /properties/p1");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ priceCents: 120_000, listingType: "RENT" }),
    );
    expect(publish).toHaveBeenCalledWith({ id: "p1" });
  });

  it("calls nothing when a field is wrong, and keeps what was typed", async () => {
    const state = await publishProperty(
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
      publishProperty(initialPublishFormState, validForm()),
    ).rejects.toThrow("REDIRECT /login?callbackUrl=/publish");
  });

  it("shows a general error when creating fails", async () => {
    create.mockRejectedValue(new Error("db down"));

    const state = await publishProperty(initialPublishFormState, validForm());

    expect(state.formError).toMatch(/something went wrong/i);
    expect(state.draftId).toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it("keeps the draft when publishing fails, and the retry only publishes it", async () => {
    create.mockResolvedValue({ id: "p1" });
    publish.mockRejectedValueOnce(new Error("timeout"));

    const failed = await publishProperty(initialPublishFormState, validForm());
    expect(failed.draftId).toBe("p1");
    expect(failed.formError).toMatch(/saved but couldn't be published/);
    expect(failed.values.title).toBe("Bright flat near the beach");

    // The retry sends only the draft id (the fields are disabled, so the browser leaves them out).
    publish.mockResolvedValue({ id: "p1" });
    const retry = new FormData();
    retry.set("draftId", "p1");
    await expect(publishProperty(failed, retry)).rejects.toThrow(
      "REDIRECT /properties/p1",
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("opens the listing if it was already published (a late second click)", async () => {
    publish.mockRejectedValue(new TRPCError({ code: "CONFLICT" }));
    const retry = new FormData();
    retry.set("draftId", "p1");

    await expect(
      publishProperty(initialPublishFormState, retry),
    ).rejects.toThrow("REDIRECT /properties/p1");
  });

  it("doesn't open someone else's listing through a forged draft id", async () => {
    publish.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const retry = new FormData();
    retry.set("draftId", "not-mine");

    const state = await publishProperty(initialPublishFormState, retry);

    expect(redirect).not.toHaveBeenCalled();
    expect(state.formError).toBeDefined();
  });
});
