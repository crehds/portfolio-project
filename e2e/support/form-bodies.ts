// Form bodies of a chosen size, for the tests of the Action's body limit
// (`security.actionBodySizeLimit`, see src/modules/contact/form-body-limit.ts).
//
// A browser sends the form as `application/x-www-form-urlencoded`: `name=value` pairs joined
// with `&`, every byte of a value that is not an unreserved ASCII character written as `%XX`.
// A character that takes three bytes in UTF-8 (CJK, Devanagari, Thai...) is one UTF-16 unit
// to the schema's length limits and nine bytes in the body; a two-byte one (Cyrillic, Greek,
// Arabic, Hebrew) is six. So a message at its limit in such a script is far bigger than its
// character count says, and that is what the body limit must leave room for.
import { turnstileToken } from './fake-upstreams';

/**
 * The longest value each field accepts, as the tests read them: the schema's limits
 * (`CONTACT_LIMITS`) and the longest token the verifier asks Turnstile about
 * (`MAX_TOKEN_LENGTH`). src/modules/contact/form-body-limit.test.ts checks the limit of the
 * body against the real ones, so these only have to be the numbers a visitor can reach.
 */
export const LARGEST = { name: 100, email: 254, message: 5000, token: 2048 };

/** A character that takes three bytes in UTF-8 and is one UTF-16 unit. */
export const THREE_BYTE_CHARACTER = '字';

/** A character that takes two bytes in UTF-8 and is one UTF-16 unit. */
export const TWO_BYTE_CHARACTER = 'я';

/** The text of exactly `units` UTF-16 units: `prefix`, then `character` over and over. */
export function textOf(units: number, character: string, prefix = ''): string {
  return prefix + character.repeat(units - prefix.length);
}

/** A token Turnstile's fake accepts, as long as the longest the verifier will ask about. */
export function longestToken(marker: string): string {
  return turnstileToken('pass', marker).padEnd(LARGEST.token, 'a');
}

/**
 * A valid submission with every field at its limit: the name and the message in
 * `character`, an email address of 254 characters, the longest token, and the honeypot
 * empty as a person leaves it. The marker opens the message, so a test finds its calls.
 */
export function largestFields(
  marker: string,
  character: string,
  locale = 'en',
): Record<string, string> {
  const domain = '@example.com';

  return {
    name: textOf(LARGEST.name, character),
    email: `${'a'.repeat(LARGEST.email - domain.length)}${domain}`,
    message: textOf(LARGEST.message, character, marker),
    website: '',
    'cf-turnstile-response': longestToken(marker),
    locale,
  };
}

/** The urlencoded body a browser sends for `fields`. */
export function urlencoded(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

/**
 * A urlencoded body of exactly `bytes` bytes (the body is ASCII, so a byte is a character):
 * the ordinary valid fields, with the message made as long as it takes. The message opens
 * with the marker and is padded with `x`, which is written as it is, so its length in the
 * body is its length. Past the schema's limit for a message, so the Action refuses it for
 * what it says when it is read at all.
 */
export function bodyOfExactly(bytes: number, marker: string): string {
  const fields = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: '',
    locale: 'en',
    'cf-turnstile-response': turnstileToken('pass', marker),
  };
  const emptyMessage = urlencoded(fields).length;
  const messageLength = bytes - emptyMessage;

  if (messageLength < marker.length) {
    throw new Error(`A body of ${bytes} bytes cannot hold the marker.`);
  }

  return urlencoded({
    ...fields,
    message: textOf(messageLength, 'x', marker),
  });
}
