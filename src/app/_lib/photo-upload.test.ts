import { describe, expect, it, vi } from "vitest";

import {
  canRetryPhoto,
  checkPhotoFiles,
  createTurnQueue,
  formatFileSize,
  GENERIC_PHOTO_ERROR,
  movedOrder,
  photoErrorMessage,
  photoMimeTypeOf,
  photoSlotsLeft,
  StorageUploadError,
  UPLOAD_FAILED_MESSAGE,
  uploadPhoto,
} from "./photo-upload";

const MB = 1024 * 1024;

function file(name: string, size = 1 * MB, type = "image/jpeg") {
  return { name, size, type };
}

/** A tRPC client error as the browser gets it (only the fields the code reads). */
function trpcError(
  code: string,
  message = "",
  fieldErrors?: Record<string, string[]>,
) {
  return Object.assign(new Error(message), {
    data: { code, zodError: fieldErrors ? { fieldErrors } : null },
  });
}

describe("photoMimeTypeOf", () => {
  it("accepts JPG and PNG by their type", () => {
    expect(photoMimeTypeOf(file("a.jpg"))).toBe("image/jpeg");
    expect(photoMimeTypeOf(file("a.png", MB, "image/png"))).toBe("image/png");
    // Old browsers send the non-standard "image/jpg".
    expect(photoMimeTypeOf(file("a.jpg", MB, "image/jpg"))).toBe("image/jpeg");
  });

  it("refuses other types, even with a .jpg name", () => {
    expect(photoMimeTypeOf(file("a.webp", MB, "image/webp"))).toBeNull();
    expect(photoMimeTypeOf(file("a.heic", MB, "image/heic"))).toBeNull();
    expect(photoMimeTypeOf(file("doc.jpg", MB, "application/pdf"))).toBeNull();
  });

  it("uses the extension when the browser gives no type", () => {
    expect(photoMimeTypeOf(file("HOUSE.JPEG", MB, ""))).toBe("image/jpeg");
    expect(photoMimeTypeOf(file("plan.png", MB, ""))).toBe("image/png");
    expect(photoMimeTypeOf(file("notes.txt", MB, ""))).toBeNull();
    expect(photoMimeTypeOf(file("no-extension", MB, ""))).toBeNull();
  });
});

describe("checkPhotoFiles", () => {
  it("accepts valid files in the order they were chosen", () => {
    const a = file("a.jpg");
    const b = file("b.png", 2 * MB, "image/png");

    const { accepted, errors } = checkPhotoFiles([a, b], 15);

    expect(accepted).toEqual([
      { file: a, mimeType: "image/jpeg" },
      { file: b, mimeType: "image/png" },
    ]);
    expect(errors).toEqual([]);
  });

  it("refuses wrong types, empty files and files over 5 MB, one message each", () => {
    const { accepted, errors } = checkPhotoFiles(
      [
        file("doc.pdf", MB, "application/pdf"),
        file("empty.jpg", 0),
        file("big.jpg", 6.3 * MB),
        file("ok.jpg"),
      ],
      15,
    );

    expect(accepted.map(({ file }) => file.name)).toEqual(["ok.jpg"]);
    expect(errors).toEqual([
      `"doc.pdf" isn't a JPG or PNG photo.`,
      `"empty.jpg" is empty.`,
      `"big.jpg" is 6.3 MB. Each photo can be at most 5 MB.`,
    ]);
  });

  it("accepts exactly 5 MB and refuses one byte more", () => {
    expect(checkPhotoFiles([file("a.jpg", 5 * MB)], 15).accepted).toHaveLength(
      1,
    );
    expect(
      checkPhotoFiles([file("a.jpg", 5 * MB + 1)], 15).accepted,
    ).toHaveLength(0);
  });

  it("only adds the photos that fit and names the rest", () => {
    const { accepted, errors } = checkPhotoFiles(
      [file("1.jpg"), file("2.jpg"), file("3.jpg")],
      2,
    );

    expect(accepted.map(({ file }) => file.name)).toEqual(["1.jpg", "2.jpg"]);
    expect(errors).toEqual([
      `Only 2 more could be added, up to the maximum of 15 photos. Not added: "3.jpg".`,
    ]);
  });

  it("adds nothing when the gallery is full", () => {
    const { accepted, errors } = checkPhotoFiles([file("1.jpg")], 0);

    expect(accepted).toEqual([]);
    expect(errors).toEqual([
      `The listing already has the maximum of 15 photos. Not added: "1.jpg".`,
    ]);
  });

  it("doesn't let invalid files use up the free places", () => {
    const { accepted } = checkPhotoFiles(
      [file("big.jpg", 9 * MB), file("ok.jpg")],
      1,
    );
    expect(accepted.map(({ file }) => file.name)).toEqual(["ok.jpg"]);
  });
});

describe("photoSlotsLeft", () => {
  it("counts the gallery and the uploads in progress, never below 0", () => {
    expect(photoSlotsLeft(0, 0)).toBe(15);
    expect(photoSlotsLeft(10, 3)).toBe(2);
    expect(photoSlotsLeft(15, 0)).toBe(0);
    expect(photoSlotsLeft(14, 3)).toBe(0);
  });
});

describe("formatFileSize", () => {
  it("shows MB with one decimal and small files in KB", () => {
    expect(formatFileSize(5.25 * MB)).toBe("5.3 MB");
    expect(formatFileSize(820 * 1024)).toBe("820 KB");
    expect(formatFileSize(10)).toBe("1 KB");
  });
});

describe("photoErrorMessage", () => {
  it("shows the first field error of a refused input", () => {
    const error = trpcError("BAD_REQUEST", "", {
      mimeType: ["Only JPG or PNG photos are allowed"],
    });
    expect(photoErrorMessage(error)).toBe(
      "Only JPG or PNG photos are allowed.",
    );
  });

  it("shows the server's message for other refusals (16th photo, damaged file)", () => {
    const error = trpcError(
      "BAD_REQUEST",
      "A listing can have at most 15 photos.",
    );
    expect(photoErrorMessage(error)).toBe(
      "A listing can have at most 15 photos.",
    );
  });

  it("explains an expired session and a listing that isn't the user's", () => {
    expect(photoErrorMessage(trpcError("UNAUTHORIZED"))).toMatch(/sign in/i);
    expect(photoErrorMessage(trpcError("FORBIDDEN"))).toMatch(/isn't yours/);
    expect(photoErrorMessage(trpcError("NOT_FOUND"))).toMatch(/isn't yours/);
  });

  it("ends every message with a period", () => {
    expect(
      photoErrorMessage(
        trpcError("BAD_REQUEST", "Only JPG or PNG photos are allowed"),
      ),
    ).toBe("Only JPG or PNG photos are allowed.");
  });

  it("never shows internal details of a server error", () => {
    expect(
      photoErrorMessage(
        trpcError("INTERNAL_SERVER_ERROR", "Photo storage is not configured."),
      ),
    ).toBe(GENERIC_PHOTO_ERROR);
  });

  it("asks to check the connection when the upload itself failed", () => {
    expect(photoErrorMessage(new StorageUploadError(403))).toBe(
      UPLOAD_FAILED_MESSAGE,
    );
    expect(photoErrorMessage(new TypeError("Failed to fetch"))).toBe(
      UPLOAD_FAILED_MESSAGE,
    );
  });
});

describe("canRetryPhoto", () => {
  it("offers a retry only when trying again can work", () => {
    expect(canRetryPhoto(new StorageUploadError())).toBe(true);
    expect(canRetryPhoto(new TypeError("Failed to fetch"))).toBe(true);
    expect(canRetryPhoto(trpcError("INTERNAL_SERVER_ERROR"))).toBe(true);
    expect(canRetryPhoto(trpcError("CONFLICT"))).toBe(true);

    expect(canRetryPhoto(trpcError("BAD_REQUEST"))).toBe(false);
    expect(canRetryPhoto(trpcError("FORBIDDEN"))).toBe(false);
    expect(canRetryPhoto(trpcError("UNAUTHORIZED"))).toBe(false);
  });
});

describe("uploadPhoto", () => {
  const photo = new Blob(["fake image"], { type: "image/jpeg" });

  function steps(put: typeof fetch) {
    return {
      createUpload: vi.fn().mockResolvedValue({
        key: "properties/p1/abc.jpg",
        uploadUrl: "https://storage.test/signed",
        headers: { "Content-Type": "image/jpeg" },
      }),
      confirm: vi.fn().mockResolvedValue({ id: "img1", isCover: true }),
      put,
    };
  }

  it("asks for a URL, uploads the file to it and confirms the key", async () => {
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const s = steps(put);

    const saved = await uploadPhoto(
      "p1",
      { file: photo, mimeType: "image/jpeg" },
      s,
    );

    expect(s.createUpload).toHaveBeenCalledWith({
      propertyId: "p1",
      mimeType: "image/jpeg",
      sizeBytes: photo.size,
    });
    expect(put).toHaveBeenCalledWith("https://storage.test/signed", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: photo,
    });
    expect(s.confirm).toHaveBeenCalledWith({
      propertyId: "p1",
      key: "properties/p1/abc.jpg",
    });
    expect(saved).toEqual({ id: "img1", isCover: true });
  });

  it("doesn't confirm when the storage refuses the file", async () => {
    const s = steps(
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    await expect(
      uploadPhoto("p1", { file: photo, mimeType: "image/jpeg" }, s),
    ).rejects.toBeInstanceOf(StorageUploadError);
    expect(s.confirm).not.toHaveBeenCalled();
  });

  it("turns a network failure of the upload into a StorageUploadError", async () => {
    const s = steps(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      uploadPhoto("p1", { file: photo, mimeType: "image/jpeg" }, s),
    ).rejects.toBeInstanceOf(StorageUploadError);
  });

  it("uploads nothing when the server refuses to give a URL", async () => {
    const put = vi.fn();
    const s = steps(put);
    s.createUpload.mockRejectedValue(
      trpcError("BAD_REQUEST", "A listing can have at most 15 photos."),
    );

    await expect(
      uploadPhoto("p1", { file: photo, mimeType: "image/jpeg" }, s),
    ).rejects.toThrow("at most 15 photos");
    expect(put).not.toHaveBeenCalled();
  });
});

describe("movedOrder", () => {
  const ids = ["a", "b", "c"];

  it("swaps the photo with its neighbour", () => {
    expect(movedOrder(ids, 0, 1)).toEqual(["b", "a", "c"]);
    expect(movedOrder(ids, 2, -1)).toEqual(["a", "c", "b"]);
    expect(ids).toEqual(["a", "b", "c"]); // not changed in place
  });

  it("does nothing past either end or for an unknown index", () => {
    expect(movedOrder(ids, 0, -1)).toBeNull();
    expect(movedOrder(ids, 2, 1)).toBeNull();
    expect(movedOrder(ids, 5, -1)).toBeNull();
    expect(movedOrder([], 0, 1)).toBeNull();
  });
});

describe("createTurnQueue", () => {
  it("lets each turn go only after the earlier ones are done, whatever finishes first", async () => {
    const takeTurn = createTurnQueue();
    const first = takeTurn();
    const second = takeTurn();
    const third = takeTurn();
    const order: string[] = [];

    const thirdDone = third.wait.then(() => order.push("third"));
    const secondDone = second.wait.then(() => order.push("second"));
    await first.wait;
    order.push("first");

    // The third upload is ready before the second, but still waits for it.
    expect(order).toEqual(["first"]);
    first.done();
    await secondDone;
    expect(order).toEqual(["first", "second"]);
    second.done();
    await thirdDone;
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("doesn't block later turns when an earlier one fails", async () => {
    const takeTurn = createTurnQueue();
    const failed = takeTurn();
    const next = takeTurn();

    failed.done(); // called from `finally`, also after an error
    await expect(next.wait).resolves.toBeUndefined();
  });
});
