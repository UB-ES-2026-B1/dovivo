"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  charactersLeft,
  checkMessage,
  contactFailure,
} from "~/app/_lib/contact-form";
import { loginToContactHref } from "~/app/_lib/listing-text";
import { MESSAGE_MAX_LENGTH } from "~/lib/validators/conversation";
import { api } from "~/trpc/react";

/**
 * Contact form on the listing page (US-21.F1 / F2), only for signed-in users who don't own the
 * listing (`AdvertiserCard` decides). Checks the message with the server's schema before sending
 * (never empty), then shows a confirmation or the error, keeping what was typed. The advertiser
 * gets the message by email.
 */
export function ContactForm({
  propertyId,
  advertiserName,
}: {
  propertyId: string;
  advertiserName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  const start = api.conversation.start.useMutation({
    onSuccess: () => {
      setBody("");
      setSent(true);
    },
    onError: (error) => {
      const failure = contactFailure(error);
      if (failure.kind === "login") {
        router.push(loginToContactHref(propertyId));
      } else if (failure.kind === "field") {
        setFieldError(failure.message);
        textareaRef.current?.focus();
      } else {
        setFormError(failure.message);
      }
    },
  });

  // Move the focus to the confirmation, so keyboard and screen reader users hear it and don't stay
  // on a button that is gone.
  useEffect(() => {
    if (sent) confirmationRef.current?.focus();
  }, [sent]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const error = checkMessage(body);
    setFieldError(error);
    if (error) {
      textareaRef.current?.focus();
      return;
    }
    start.mutate({ propertyId, body });
  }

  if (sent) {
    return (
      <div
        ref={confirmationRef}
        tabIndex={-1}
        role="status"
        className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 focus:outline-none"
      >
        <p className="font-medium">Message sent</p>
        <p className="mt-1 break-words">
          {advertiserName} will get it by email and can answer you.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 font-medium text-emerald-800 underline hover:text-emerald-900"
        >
          Send another message
        </button>
      </div>
    );
  }

  const left = charactersLeft(body);
  const errorId = "contact-message-error";
  const counterId = "contact-message-counter";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Contact the advertiser"
    >
      <label htmlFor="contact-message" className="block text-sm font-medium">
        Message
      </label>
      <textarea
        ref={textareaRef}
        id="contact-message"
        name="body"
        rows={5}
        // A bit over the limit, so pasting a long text shows the error instead of cutting it.
        maxLength={MESSAGE_MAX_LENGTH + 100}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (fieldError) setFieldError(null);
        }}
        disabled={start.isPending}
        placeholder="Hi, I'm interested in this home. Is it still available?"
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? `${errorId} ${counterId}` : counterId}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-emerald-700 focus:outline-none disabled:bg-slate-50 aria-invalid:border-red-500"
      />
      {fieldError && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {fieldError}
        </p>
      )}
      <p
        id={counterId}
        className={`mt-1 text-xs ${left < 0 ? "text-red-600" : "text-slate-500"}`}
      >
        {left < 0
          ? `${-left} characters over the limit`
          : `${left} characters left`}
      </p>

      {formError && (
        <p role="alert" className="mt-3 text-sm break-words text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={start.isPending}
        className="mt-3 w-full rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {start.isPending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
