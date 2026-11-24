import nodemailer, { type Transporter } from "nodemailer";

import { env } from "~/env";

/**
 * Email service (T-16): sends the app's emails (new message to the advertiser, US-21; later
 * US-23, US-06, US-08) through any SMTP server. Mailpit locally (`pnpm mail:up`), a Mailtrap
 * sandbox for the demo, or any SMTP provider in production: only the `SMTP_*` variables change.
 *
 * Kept behind this small interface so callers can be tested with a fake.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text version, for clients that don't show HTML. */
  text: string;
  html: string;
};

export type EmailSender = {
  send(message: EmailMessage): Promise<void>;
};

/** Fail fast: a slow or unreachable SMTP server must not keep the request waiting for minutes. */
const SMTP_TIMEOUTS = {
  connectionTimeout: 5_000,
  greetingTimeout: 5_000,
  socketTimeout: 10_000,
};

export function createSmtpEmailSender(
  transport: Pick<Transporter, "sendMail">,
  from: string,
): EmailSender {
  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}

const DEFAULT_FROM = "dovivo <no-reply@dovivo.local>";
const DEFAULT_APP_URL = "http://localhost:3000";

let cached: EmailSender | null | undefined;

/**
 * The sender configured in the env, or `null` when `SMTP_HOST` is missing, e.g. on a machine that
 * hasn't set it up: the rest of the app works, emails are only logged as not sent.
 */
export function getEmailSender(): EmailSender | null {
  if (cached !== undefined) return cached;

  if (!env.SMTP_HOST) {
    cached = null;
    return cached;
  }

  // With `SKIP_ENV_VALIDATION` zod doesn't run, so `env` holds the raw strings: no defaults and
  // "true" instead of `true`. Read the values so they work either way.
  const port = Number(env.SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: String(env.SMTP_SECURE) === "true",
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    ...SMTP_TIMEOUTS,
  });
  cached = createSmtpEmailSender(transport, env.EMAIL_FROM || DEFAULT_FROM);
  return cached;
}

/** Public URL of the app, for the links in the emails. No trailing slash. */
export function getAppUrl(): string {
  return (env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
}
