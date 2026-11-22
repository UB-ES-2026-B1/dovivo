import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialPublishDraftState } from "~/app/publish/[id]/photos/form-state";

const { publish, redirect } = vi.hoisted(() => ({
  publish: vi.fn(),
  // Like Next's `redirect`, it throws so the action stops there.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("~/trpc/server", () => ({ api: { property: { publish } } }));
vi.mock("next/navigation", () => ({ redirect }));

const { publishDraft } = await import("./actions");

function form(propertyId?: string) {
  const data = new FormData();
  if (propertyId !== undefined) data.set("propertyId", propertyId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("publishDraft", () => {
  it("publishes the draft and opens its page", async () => {
    publish.mockResolvedValue({ id: "p1" });

    await expect(
      publishDraft(initialPublishDraftState, form("p1")),
    ).rejects.toThrow("REDIRECT /properties/p1");
    expect(publish).toHaveBeenCalledWith({ id: "p1" });
  });

  it("opens the listing if it was already published (a late second click)", async () => {
    publish.mockRejectedValue(new TRPCError({ code: "CONFLICT" }));

    await expect(
      publishDraft(initialPublishDraftState, form("p1")),
    ).rejects.toThrow("REDIRECT /properties/p1");
  });

  it("goes to the login and back to this step when the session has expired", async () => {
    publish.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED" }));

    await expect(
      publishDraft(initialPublishDraftState, form("p1")),
    ).rejects.toThrow("REDIRECT /login?callbackUrl=%2Fpublish%2Fp1%2Fphotos");
  });

  it("doesn't open someone else's listing through a forged id", async () => {
    publish.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));

    const state = await publishDraft(
      initialPublishDraftState,
      form("not-mine"),
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(state.error).toMatch(/isn't yours/);
  });

  it("calls nothing without an id", async () => {
    const state = await publishDraft(initialPublishDraftState, form());

    expect(publish).not.toHaveBeenCalled();
    expect(state.error).toBeDefined();
  });

  it("keeps the draft and lets the user try again when publishing fails", async () => {
    publish.mockRejectedValue(new Error("timeout"));

    const state = await publishDraft(initialPublishDraftState, form("p1"));

    expect(state.error).toMatch(/saved as a draft/);
    expect(redirect).not.toHaveBeenCalled();
  });
});
