import { describe, expect, it, vi } from "vitest";

import { createSmtpEmailSender } from "./email";

describe("createSmtpEmailSender", () => {
  it("sends the message from the configured address", async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };
    const sender = createSmtpEmailSender(
      transport,
      "dovivo <no-reply@dovivo.test>",
    );

    await sender.send({
      to: "marta@example.com",
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: "dovivo <no-reply@dovivo.test>",
      to: "marta@example.com",
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("lets SMTP errors through, so the caller decides what to do", async () => {
    const error = new Error("SMTP down");
    const sender = createSmtpEmailSender(
      { sendMail: vi.fn().mockRejectedValue(error) },
      "dovivo <no-reply@dovivo.test>",
    );

    await expect(
      sender.send({ to: "a@example.com", subject: "s", text: "t", html: "h" }),
    ).rejects.toBe(error);
  });
});
