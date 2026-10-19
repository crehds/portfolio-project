// Pure and free of imports: `astro.config.mjs` reads `ACTION_BODY_LIMIT_BYTES` from here, so
// this has to load with nothing around it (no Astro, no Zod).

/**
 * The most bytes Astro reads from the body of a request to an Action
 * (`security.actionBodySizeLimit`, which `astro.config.mjs` sets from this). A body past it
 * is refused before it is parsed, with a 413 and no provider asked; Astro's own default is
 * 1 MiB, which would let anyone make the Worker read and buffer that much per request.
 *
 * 64 KiB leaves room for the largest submission the form can legitimately send, which is
 * about 52 KB (`largestFormBodyBytes`): a browser sends the form urlencoded, and a message
 * of 5,000 characters in a script whose characters take three bytes in UTF-8 (CJK,
 * Devanagari, Thai) is 45,000 bytes once each byte is written `%XX`. A two-byte script
 * (Cyrillic, Greek, Arabic, Hebrew) passes 32 KiB at full length too. The tests keep this
 * number above what the schema's limits can produce, and not much above it.
 */
export const ACTION_BODY_LIMIT_BYTES = 64 * 1024;

/** The most a UTF-16 unit of a visitor's text costs in a urlencoded body. */
const WORST_BYTES_PER_TEXT_UNIT = 9;

/** The most a character of an ASCII-only value costs: `%XX`, for `@`, `+` and the like. */
const WORST_BYTES_PER_ASCII_CHARACTER = 3;

/** The locale field is `en` or `es`. */
const LOCALE_LENGTH = 2;

/**
 * The largest body a legitimate submission of the contact form can have, in bytes: every
 * field at its limit, in the worst case for its kind. The form is posted as
 * `application/x-www-form-urlencoded`, so the body is `name=value` pairs joined with `&`, and
 * every byte of a value that is not an unreserved ASCII character is written `%XX`:
 *
 * - The name and the message hold any text. The worst case per UTF-16 unit, which is what the
 *   schema's limits count, is a character of three bytes in UTF-8 that is one unit (every
 *   character from U+0800 to U+FFFF), written `%XX%XX%XX`: nine bytes. A character outside
 *   the Basic Multilingual Plane is two units and twelve bytes, six a unit, so it costs less.
 * - The email address and the Turnstile token are ASCII, and three bytes a character is the
 *   worst case.
 * - The honeypot is empty for a person, and the locale is two characters.
 *
 * `limits` are the schema's (`CONTACT_LIMITS`) and `tokenLength` is the longest token the
 * verifier asks Turnstile about (`MAX_TOKEN_LENGTH`); the unit tests pass the real ones.
 */
export function largestFormBodyBytes(
  limits: { name: number; email: number; message: number },
  tokenLength: number,
): number {
  const fields: [name: string, valueBytes: number][] = [
    ['name', limits.name * WORST_BYTES_PER_TEXT_UNIT],
    ['email', limits.email * WORST_BYTES_PER_ASCII_CHARACTER],
    ['message', limits.message * WORST_BYTES_PER_TEXT_UNIT],
    ['website', 0],
    ['cf-turnstile-response', tokenLength * WORST_BYTES_PER_ASCII_CHARACTER],
    ['locale', LOCALE_LENGTH],
  ];

  // `name=value` for each field, and the `&` between one pair and the next.
  const pairs = fields.reduce(
    (sum, [name, valueBytes]) => sum + name.length + 1 + valueBytes,
    0,
  );
  return pairs + (fields.length - 1);
}
