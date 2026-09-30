import { z } from 'astro/zod';

import { LOCALES } from '../../shared/i18n/locales';

/**
 * Every message a contact field issue can carry. Astro sends a rejected form to the page
 * as `ActionInputError.fields`, a list of these messages per field, so they are stable
 * codes (never text for a human) and the page translates each one through its dictionary.
 *
 * - `required`: nothing usable was sent (missing, empty or only whitespace).
 * - `invalid_email`: not a valid email address.
 * - `too_long`: past the field's limit in `CONTACT_LIMITS`.
 * - `invalid`: a value the form cannot produce, such as an unsupported locale.
 */
export const CONTACT_ERROR_CODES = [
  'required',
  'invalid_email',
  'too_long',
  'invalid',
] as const;

export type ContactErrorCode = (typeof CONTACT_ERROR_CODES)[number];

/** Narrows an issue message from `ActionInputError.fields` to a code the page can translate. */
export function isContactErrorCode(value: unknown): value is ContactErrorCode {
  return (
    typeof value === 'string' &&
    (CONTACT_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * The longest value each visitor-written field accepts, counted in UTF-16 code units like
 * the HTML `maxlength` attribute, so the form can carry the same numbers. 254 is the
 * longest email address that can be delivered (RFC 5321 path limit).
 */
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  message: 5000,
} as const;

const REQUIRED = 'required' satisfies ContactErrorCode;
const INVALID_EMAIL = 'invalid_email' satisfies ContactErrorCode;
const TOO_LONG = 'too_long' satisfies ContactErrorCode;
const INVALID = 'invalid' satisfies ContactErrorCode;

/**
 * What a value that is not text means: Astro delivers a required field that was left
 * empty, or is absent from the request, as `null` (other callers may pass `undefined`).
 * Both mean "nothing sent"; anything else (a file, a number) is not something the form
 * produces.
 */
function notText(issue: { readonly input?: unknown }): ContactErrorCode {
  return issue.input === undefined || issue.input === null ? REQUIRED : INVALID;
}

/**
 * A required, single-purpose text field. The trim comes first: Zod runs a string's checks
 * in the order they are declared and each one sees the previous one's result, so the
 * limit and the emptiness check judge the text the visitor meant, not the spaces around
 * it. An empty result fails `min` only, which keeps it to one code per field.
 */
function requiredText(maxLength: number) {
  return z
    .string({ error: notText })
    .trim()
    .min(1, { error: REQUIRED })
    .max(maxLength, { error: TOO_LONG });
}

/**
 * The contact form's contract. `defineAction({ accept: 'form', input: contactSchema })`
 * validates the submitted `FormData` with it before the handler runs, so the handler only
 * ever sees `ContactInput`. Keys and shapes follow what Astro's `formDataToObject`
 * delivers: an empty required text field arrives as `null`, an empty optional one as
 * `undefined`.
 */
export const contactSchema = z.object({
  name: requiredText(CONTACT_LIMITS.name),
  // The length is checked first and on its own: the format check only runs on a
  // non-empty value that fits, so a huge value never reaches the email pattern. The
  // default pattern accepts ASCII addresses only.
  email: requiredText(CONTACT_LIMITS.email).pipe(
    z.email({ error: INVALID_EMAIL }),
  ),
  message: requiredText(CONTACT_LIMITS.message),
  // The honeypot: an input people never see, so any content means a bot filled it in.
  // The schema accepts whatever arrives, because rejecting it would tell the bot which
  // field gave it away; `submitContact` answers it with a silent success.
  website: z.string({ error: INVALID }).optional(),
  // The token Turnstile's widget writes into the form under this exact name. A missing
  // token is judged by `submitContact`, after the rate limit, not by the schema.
  'cf-turnstile-response': z.string({ error: INVALID }).optional(),
  // A hidden field the page fills in from the URL it was served at.
  locale: z.enum(LOCALES, { error: INVALID }),
});

/** A validated submission: the trimmed visitor text, the honeypot and the Turnstile token. */
export type ContactInput = z.output<typeof contactSchema>;
