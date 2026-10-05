// Pure: no `astro:*` or `cloudflare:*` import. The contact pages are thin roots: they read
// what the Action answered and the form values out of Astro, ask this module what to show
// and with which HTTP status, and apply the answer. Everything the visitor can run into is
// decided here, so Vitest covers it without a server.
import type { Locale } from '../../shared/i18n/locales';
import { pathnameInLocale } from '../../shared/i18n/paths';
import type { UiDictionary } from '../../shared/i18n/ui';
import type { ContactOutcome } from './domain/submit-contact';
import { NO_VALUES, type ContactValues } from './form-values';
import { isContactErrorCode, type ContactErrorCode } from './schema';

/**
 * How long a rate limited visitor is told to wait, in seconds (`Retry-After`). It is the
 * period of the `CONTACT_RATE_LIMIT` binding in `wrangler.jsonc`, which can only be 10 or
 * 60 seconds; a test keeps the two equal, so the page never promises a different wait.
 */
export const RETRY_AFTER_SECONDS = 60;

/** The fields a visitor sees, and so the only ones an error can point at. */
export const VISIBLE_FIELDS = ['name', 'email', 'message'] as const;

export type VisibleField = (typeof VISIBLE_FIELDS)[number];

/** The first error code of each visible field that has one. */
export type FieldErrors = Readonly<
  Partial<Record<VisibleField, ContactErrorCode>>
>;

/**
 * What the Action answered on this request, as plain data (the page turns Astro's action
 * result into one of these):
 *
 * - `outcome`: the handler ran and `submitContact` decided (see `ContactOutcome`).
 * - `invalid_input`: the schema refused the form, with the issue messages per field name.
 * - `too_large`: the body was past `security.actionBodySizeLimit` and was never read.
 * - `failed`: any other error of the Action. The handler never throws, so this is not
 *   expected, and the visitor is treated as if the form were unavailable.
 */
export type ContactAnswer =
  | { readonly kind: 'outcome'; readonly outcome: ContactOutcome }
  | {
      readonly kind: 'invalid_input';
      readonly fields: Readonly<Record<string, readonly string[]>>;
    }
  | { readonly kind: 'too_large' }
  | { readonly kind: 'failed' };

export interface ContactPageInput {
  /** Whether the Worker has every setting and binding the form needs. */
  readonly configured: boolean;
  /** What the Action answered; `undefined` when no Action ran, which is a plain GET. */
  readonly answer: ContactAnswer | undefined;
  /** Whether the URL carries `?sent=1`, which a successful submission redirects to. */
  readonly sent: boolean;
  /** What the visitor typed, re-read from the request when the answer keeps it. */
  readonly values: ContactValues;
}

/** The alert above the form: what went wrong that no single field explains. */
export type FormAlert =
  'verification_failed' | 'rate_limited' | 'invalid_request' | 'too_large';

/** Why the form is not offered: it cannot work, or a submission could not be delivered. */
export type FallbackCause =
  'not_configured' | 'delivery_failed' | 'unavailable';

/**
 * What the page shows:
 *
 * - `redirect_sent`: the message was sent. Answer 303 to the page's own `?sent=1`, so a
 *   reload never submits it again.
 * - `sent`: the success message (`?sent=1`).
 * - `form`: the form, with the values kept and, for a submission that did not go through,
 *   an alert and/or an error per field.
 * - `fallback`: the notice that takes the form's place, pointing to email and WhatsApp,
 *   with `message` (what the visitor wrote; empty when there is nothing to keep) in a
 *   text area to copy.
 *
 * `errorTitle` says that the document title gets the "Error:" prefix: it is set for every
 * state that answers a submission that did not go through.
 */
export type ContactPageState =
  | { readonly kind: 'redirect_sent' }
  | { readonly kind: 'sent'; readonly status: 200 }
  | {
      readonly kind: 'form';
      readonly status: 200 | 400 | 413 | 429;
      /** Seconds to wait; only for a rate limit, as the `Retry-After` header. */
      readonly retryAfter?: number;
      readonly errorTitle: boolean;
      readonly values: ContactValues;
      readonly fieldErrors: FieldErrors;
      readonly alert?: FormAlert;
    }
  | {
      readonly kind: 'fallback';
      readonly status: 200 | 502 | 503;
      readonly errorTitle: boolean;
      readonly cause: FallbackCause;
      readonly message: string;
    };

function isVisibleField(name: string): name is VisibleField {
  return (VISIBLE_FIELDS as readonly string[]).includes(name);
}

/**
 * The first error code of each visible field. A field that lists no message is skipped. A
 * message that is not a code the page knows still marks its field, as `invalid`, so the
 * visitor is never shown a form that refused them without saying where. The fields the
 * visitor cannot see (the locale, the honeypot, the Turnstile token) are left out: there
 * is nothing on the page to point at.
 */
function fieldErrorsOf(
  fields: Readonly<Record<string, readonly string[]>>,
): FieldErrors {
  const errors: { -readonly [Field in VisibleField]?: ContactErrorCode } = {};

  for (const [field, messages] of Object.entries(fields)) {
    if (!isVisibleField(field) || messages.length === 0) {
      continue;
    }

    const [first] = messages;
    errors[field] = isContactErrorCode(first) ? first : 'invalid';
  }

  return errors;
}

function fallback(
  status: 502 | 503,
  cause: FallbackCause,
  values: ContactValues,
): ContactPageState {
  return {
    kind: 'fallback',
    status,
    errorTitle: true,
    cause,
    message: values.message,
  };
}

function refused(
  status: 400 | 429,
  alert: FormAlert,
  values: ContactValues,
): ContactPageState {
  return {
    kind: 'form',
    status,
    ...(status === 429 && { retryAfter: RETRY_AFTER_SECONDS }),
    errorTitle: true,
    values,
    fieldErrors: {},
    alert,
  };
}

/**
 * Whether the values the visitor typed are worth reading back out of the request for
 * `answer`. They are not for a plain GET, for a message that was sent (the page redirects)
 * and for a body that was too large (the Action never read it, and the page must not
 * either: the limit is there so that nobody makes the Worker parse that much).
 */
export function answerKeepsValues(answer: ContactAnswer | undefined): boolean {
  if (answer === undefined || answer.kind === 'too_large') {
    return false;
  }

  return !(answer.kind === 'outcome' && answer.outcome.kind === 'sent');
}

/**
 * Decides what the contact page shows for a request, and its HTTP status.
 *
 * - A GET shows the form, or the success message for `?sent=1`, or the fallback notice
 *   (with a 200: the page itself is fine) when the Worker is not configured.
 * - A message that was sent redirects to `?sent=1`.
 * - A Worker that is not configured answers every other submission with the fallback
 *   notice and a 503, whatever the Action said: the form cannot work.
 * - Refused input is a 400 with a code per field. A token that did not verify is a 400,
 *   and a rate limit a 429 with a `Retry-After`; both keep what the visitor wrote and ask
 *   them to try again, or to write by email or WhatsApp.
 * - A message that could not be delivered (502) and a verifier that could not answer
 *   (503) are not the visitor's doing and trying again will not help: the form gives way
 *   to the fallback notice, with the message to copy.
 */
export function contactPageState(input: ContactPageInput): ContactPageState {
  const { configured, answer, sent, values } = input;

  if (answer === undefined) {
    if (sent) {
      return { kind: 'sent', status: 200 };
    }

    if (!configured) {
      return {
        kind: 'fallback',
        status: 200,
        errorTitle: false,
        cause: 'not_configured',
        message: '',
      };
    }

    return {
      kind: 'form',
      status: 200,
      errorTitle: false,
      values,
      fieldErrors: {},
    };
  }

  if (answer.kind === 'outcome' && answer.outcome.kind === 'sent') {
    return { kind: 'redirect_sent' };
  }

  if (!configured) {
    return fallback(503, 'not_configured', values);
  }

  switch (answer.kind) {
    case 'outcome':
      switch (answer.outcome.kind) {
        case 'rate_limited':
          return refused(429, 'rate_limited', values);
        case 'verification_failed':
          return refused(400, 'verification_failed', values);
        case 'delivery_failed':
          return fallback(502, 'delivery_failed', values);
        case 'unavailable':
          return fallback(503, 'unavailable', values);
        // `sent` was answered above; no other kind exists.
        default:
          return fallback(503, 'unavailable', values);
      }

    case 'invalid_input': {
      const fieldErrors = fieldErrorsOf(answer.fields);

      return {
        kind: 'form',
        status: 400,
        errorTitle: true,
        values,
        fieldErrors,
        // Nothing visible to point at: a hidden field was refused, or an issue named none.
        ...(Object.keys(fieldErrors).length === 0 && {
          alert: 'invalid_request' as const,
        }),
      };
    }

    case 'too_large':
      return {
        kind: 'form',
        status: 413,
        errorTitle: true,
        values: NO_VALUES,
        fieldErrors: {},
        alert: 'too_large',
      };

    case 'failed':
      return fallback(503, 'unavailable', values);
  }
}

/**
 * Where a message that was sent redirects to (303): the contact page of the locale it was
 * sent from, with `?sent=1`. It is built from the locale alone, which the page reads from
 * its own URL and narrows to the supported ones, never from anything in the request: a
 * visitor cannot steer the redirect, so there is no open redirect to find.
 */
export function sentLocation(locale: Locale): string {
  return `${pathnameInLocale('/contact/', locale)}?sent=1`;
}

/**
 * The document title: the page's own, or the same with the error word in front for a page
 * that answers a submission that did not go through (`errorTitle`), so that a screen reader
 * announces the problem as soon as the page loads.
 */
export function contactTitle(
  dictionary: UiDictionary,
  errorTitle: boolean,
): string {
  return errorTitle
    ? `${dictionary.contactErrorPrefix} ${dictionary.contactPageTitle}`
    : dictionary.contactPageTitle;
}
