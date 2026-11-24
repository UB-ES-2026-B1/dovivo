# ADR 0005: Email service (SMTP)

- **Status:** Accepted
- **Date:** 2026-11-20
- **Task:** T-16 (email service) · first used by US-21 (#75); later US-23, US-06, US-08
- **See also:** [ADR 0003](./0003-chat-and-chatbot.md) (US-21 flow), contract §7

## Context

US-21 isn't done until the advertiser gets an email with the message and a link to the listing
(ADR 0003). Later stories need email too: new-message alerts (US-23), email verification (US-06)
and password reset (US-08). We need one way to send email that:

- works locally without an account and never emails real people by mistake;
- can be shown in the demo (the issue suggested Mailtrap);
- can move to a real provider in production without changing code.

## Decision

**SMTP with [nodemailer](https://nodemailer.com/)**, behind a small `EmailSender` interface
(`src/server/services/email.ts`). Only the `SMTP_*` variables change between environments:

| Environment | SMTP server | Where the emails end up |
| --- | --- | --- |
| Local | **Mailpit** in Docker Compose (`pnpm mail:up`, SMTP `localhost:1025`) | Web inbox at http://localhost:8025, nothing leaves the machine |
| Demo / staging | **Mailtrap** sandbox (`sandbox.smtp.mailtrap.io:2525`) | Mailtrap's inbox, nothing reaches real addresses |
| Production | Any provider's SMTP (Resend, Brevo, SES, Mailtrap sending...) | The real inbox |

- **Optional**, like the photo storage (ADR 0004): without `SMTP_HOST`, `getEmailSender()` is
  `null`, the app works and each email is logged as not sent.
- **Never blocks the action**: a failed email is logged and the action that triggered it still
  succeeds (US-21: the message is saved, ADR 0003). Timeouts are short (5 s to connect, 10 s per
  socket), so a down SMTP server doesn't hang the request.
- **Templates** are pure functions that return `{ to, subject, text, html }`
  (`src/server/services/new-message-email.ts`): user text is HTML-escaped and subjects are kept
  on one line. English, like the rest of the app, until the language is decided (contract §7).
- **No contact data**: the email to the advertiser has the sender's name and the message, never
  their email or phone. Logs name the conversation, never an email address.
- Links use `APP_URL` (default `http://localhost:3000`).

### Spam limit (US-21)

Each message sends an email, so `conversation.start` allows **20 messages per user per hour**
(`messageRateLimiter`, in memory per instance like the other limits in ADR 0002). It's checked
after the access checks, and a message that couldn't be saved is handed back.

## Alternatives considered

| Option | Why not |
| --- | --- |
| A provider's HTTP API and SDK (Resend, SendGrid...) | Ties the code to one vendor and needs an account even locally. Most of them also accept SMTP, so we can still use them |
| Sending in a background job / queue | No queue in our single-container deployment (ADR 0001). Sending inline with short timeouts is enough at MVP volume |
| Only logging the email in dev | You can't see what the advertiser gets (HTML, link). Mailpit shows the real email |

## Consequences

- New variables in `.env.example` and `src/env.js`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASSWORD`, `SMTP_SECURE`, `EMAIL_FROM`, `APP_URL`. Staging and production need them
  (and `APP_URL` set to the public URL, or the links point to localhost).
- `conversation.start` waits for the SMTP server (usually well under a second; at most the
  timeouts above) before answering.
- The advertiser can't answer from the email yet: replying is in-app chat (US-22).
- A failed email isn't retried. If that becomes a problem, add an outbox table and a retry job.
