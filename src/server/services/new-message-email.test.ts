import { describe, expect, it } from "vitest";

import { escapeHtml, listingUrl, newMessageEmail } from "./new-message-email";

const input = {
  advertiserName: "Marta",
  senderName: "Joan",
  listingTitle: "Pis a Gràcia",
  listingUrl: "https://dovivo.test/properties/prop_1",
  body: "Hola,\nEs pot visitar dissabte?",
};

describe("listingUrl", () => {
  it("links to the listing's detail page", () => {
    expect(listingUrl("https://dovivo.test", "prop_1")).toBe(
      "https://dovivo.test/properties/prop_1",
    );
  });

  it("encodes the id", () => {
    expect(listingUrl("https://dovivo.test", "a/b?c")).toBe(
      "https://dovivo.test/properties/a%2Fb%3Fc",
    );
  });
});

describe("newMessageEmail", () => {
  it("goes to the advertiser with the listing in the subject", () => {
    const email = newMessageEmail("marta@example.com", input);

    expect(email.to).toBe("marta@example.com");
    expect(email.subject).toBe('New message about "Pis a Gràcia"');
  });

  it("includes the message, the sender's name and the link to the listing (US-21)", () => {
    const { text, html } = newMessageEmail("marta@example.com", input);

    expect(text).toContain("Hi Marta,");
    expect(text).toContain(
      'Joan sent you a message about your listing "Pis a Gràcia"',
    );
    expect(text).toContain("Hola,\nEs pot visitar dissabte?");
    expect(text).toContain(
      "See the listing: https://dovivo.test/properties/prop_1",
    );
    expect(html).toContain('href="https://dovivo.test/properties/prop_1"');
    expect(html).toContain("Hola,\nEs pot visitar dissabte?");
  });

  it("escapes the user's text in the HTML", () => {
    const { html, text } = newMessageEmail("marta@example.com", {
      ...input,
      senderName: "<b>Joan</b>",
      listingTitle: 'Pis "bonic" & gran',
      body: '<script>alert("x")</script><a href="https://evil.test">click</a>',
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="https://evil.test"');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Joan&lt;/b&gt;");
    expect(html).toContain("Pis &quot;bonic&quot; &amp; gran");
    // The plain-text version is shown as text by every client: no escaping needed.
    expect(text).toContain('<script>alert("x")</script>');
  });

  it("keeps the subject on one line, whatever the title has", () => {
    const { subject } = newMessageEmail("marta@example.com", {
      ...input,
      listingTitle: "Pis\r\nBcc: someone@example.com",
    });

    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe('New message about "Pis Bcc: someone@example.com"');
  });

  it("works without the advertiser's or the sender's name", () => {
    const { text } = newMessageEmail("marta@example.com", {
      ...input,
      advertiserName: null,
      senderName: "  ",
    });

    expect(text).toMatch(/^Hi,\n/);
    expect(text).toContain("A dovivo user sent you a message");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});
