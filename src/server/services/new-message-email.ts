import { type EmailMessage } from "~/server/services/email";

/**
 * Email to the advertiser when someone writes about one of their listings (US-21.B2): the
 * message and a link to the listing. Same language as the rest of the app (English) until the
 * team decides otherwise (contract §7, "Idioma i format dels missatges").
 *
 * The sender's email or phone are never included: contact data stays inside dovivo.
 */
export type NewMessageEmailInput = {
  advertiserName: string | null;
  senderName: string | null;
  listingTitle: string;
  listingUrl: string;
  body: string;
};

/** Link to a listing's detail page. `appUrl` has no trailing slash (see `getAppUrl`). */
export function listingUrl(appUrl: string, propertyId: string): string {
  return `${appUrl}/properties/${encodeURIComponent(propertyId)}`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** User text goes into the HTML as text, never as markup. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** One line: a title with line breaks can't add lines to the subject. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function newMessageEmail(
  to: string,
  {
    advertiserName,
    senderName,
    listingTitle,
    listingUrl,
    body,
  }: NewMessageEmailInput,
): EmailMessage {
  const title = oneLine(listingTitle);
  const sender = oneLine(senderName ?? "") || "A dovivo user";
  const greeting = advertiserName?.trim()
    ? `Hi ${oneLine(advertiserName)},`
    : "Hi,";

  const text = [
    greeting,
    "",
    `${sender} sent you a message about your listing "${title}":`,
    "",
    body,
    "",
    `See the listing: ${listingUrl}`,
    "",
    "— dovivo",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: sans-serif; color: #1f2937; line-height: 1.5;">
    <p>${escapeHtml(greeting)}</p>
    <p><strong>${escapeHtml(sender)}</strong> sent you a message about your listing
      <strong>${escapeHtml(title)}</strong>:</p>
    <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #d1d5db; white-space: pre-wrap;">${escapeHtml(body)}</blockquote>
    <p><a href="${escapeHtml(listingUrl)}">See the listing</a></p>
    <p style="color: #6b7280;">— dovivo</p>
  </body>
</html>`;

  return {
    to,
    subject: `New message about "${title}"`,
    text,
    html,
  };
}
