// Pure: no `astro:*` or `cloudflare:*` import. The structural pieces below are all this
// needs from the outside, so Vitest drives it with a fake `fetch` and the composition
// root (`create-contact-deps.ts`) wires the Worker's own in.
import type { ContactConfig } from '../config';
import type { TurnstileVerifier } from '../ports';
import {
  ProviderFailure,
  TURNSTILE_FAULT_CODES,
  type TurnstileFaultCode,
} from '../provider-failure';
import {
  globalFetch,
  isTimeout,
  postToProvider,
  requestFailure,
  type Fetch,
} from './outbound';

/**
 * Turnstile's server-side validation ("Siteverify") endpoint.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * The longest token Turnstile accepts: its server-side validation docs give the
 * `response` parameter a "Maximum length: 2048 characters"
 * (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
 * A longer value cannot be genuine, and it is visitor-controlled text, so it is refused
 * before any request is made.
 */
export const MAX_TOKEN_LENGTH = 2048;

/**
 * The body of a 200 answer, parsed. `JSON.parse` quotes the start of what it cannot parse
 * in its error, so that error is replaced with fixed text; a body read cut short by the
 * timeout signal is reported as the timeout it is.
 */
async function readAnswer(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    // The caught error is dropped, not attached as a `cause`: the parser's message quotes
    // the body, and the body is Turnstile's, not ours to pass on.
    throw isTimeout(error)
      ? requestFailure('Turnstile', error)
      : new Error('Turnstile answered with invalid JSON');
  }
}

/**
 * The error codes in a Siteverify answer that blame the visitor's token: it is missing,
 * invalid, expired or already used. A 200 that lists only these is an ordinary "no", and
 * the verifier resolves `false`. With `TURNSTILE_FAULT_CODES` they are all of Cloudflare's
 * table of error codes as of 2026-10-04: seven codes. Only the verifier needs them.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (error
 * codes)
 */
const TOKEN_ERROR_CODES: readonly string[] = [
  'missing-input-response',
  'invalid-input-response',
  'timeout-or-duplicate',
];

/** All seven codes in Cloudflare's table: any other string in an answer is unknown. */
const KNOWN_ERROR_CODES: readonly string[] = [
  ...TOKEN_ERROR_CODES,
  ...TURNSTILE_FAULT_CODES,
];

/**
 * The first of `TURNSTILE_FAULT_CODES` that `errorCodes` lists, or `undefined` when it
 * lists none or is not an array. The first of that list, not of the answer, so the code is
 * the same whatever order Turnstile lists them in. `includes` compares each entry as it
 * is, so an entry that is not the string itself (a number, a nested array, a code with a
 * space before it) matches nothing.
 */
function firstFaultCode(errorCodes: unknown): TurnstileFaultCode | undefined {
  if (!Array.isArray(errorCodes)) {
    return undefined;
  }

  return TURNSTILE_FAULT_CODES.find((code) => errorCodes.includes(code));
}

/**
 * Whether `errorCodes` lists a string that is none of `KNOWN_ERROR_CODES`: a code the
 * Worker does not know, one Cloudflare added or never documented, or text that only looks
 * like a code. It does not depend on the fault codes having been handled first. Entries
 * that are not strings are not codes and are ignored, and nothing but an array is read.
 */
function listsUnknownCode(errorCodes: unknown): boolean {
  return (
    Array.isArray(errorCodes) &&
    errorCodes.some(
      (entry) =>
        typeof entry === 'string' && !KNOWN_ERROR_CODES.includes(entry),
    )
  );
}

/**
 * The `TurnstileVerifier` that asks Turnstile's Siteverify endpoint, called from the
 * Worker with the secret key. It resolves:
 *
 * - `true` only for a 200 whose JSON says `success: true`, whatever `error-codes` says
 *   next to it, and nothing else is mistaken for it;
 * - `false` for any other 200 answer that only blames the visitor's token (rejected,
 *   expired or spent): one that lists nothing but the documented token codes, or no string
 *   at all (an empty or missing list, a list that is not an array, entries that are not
 *   strings); and for a token past Turnstile's 2,048-character maximum, which it does not
 *   even send.
 *
 * It rejects, with fixed text, when Turnstile could not be asked or could not judge the
 * token:
 *
 * - a 200 whose `error-codes` lists a code of `TURNSTILE_FAULT_CODES`: our secret or our
 *   request was at fault, or Turnstile itself, so the token was never judged, even when
 *   the answer lists a code that blames the token too. It is a `ProviderFailure` that
 *   carries one code, the first of that list that the answer lists;
 * - a 200 whose `error-codes` lists a string that is none of the documented codes, once no
 *   fault code is listed. A code the Worker does not know proves nothing about the token,
 *   so it is logged instead of being mistaken for a rejected token. It is a plain `Error`
 *   with no detail, and the code, which is Turnstile's text, is in no message and no
 *   property;
 * - any other status, as a `ProviderFailure` that carries it as its one detail;
 * - a body that is not JSON, a network error or the timeout, as plain `Error`s with no
 *   detail.
 *
 * It never retries (a token is single use, so Turnstile would only call a second try a
 * duplicate), and it makes one attempt in `AbortSignal.timeout(8000)`. It checks nothing
 * of the answer's `hostname`: previews run on other hostnames than the production one.
 *
 * It logs nothing. A rejection reaches `submitContact`, which logs one fixed line, with
 * the status or the code appended when there is one, and fails the submission closed; a
 * line here too would report one failure twice. A `false` is an ordinary answer, not a
 * failure, and is not logged.
 *
 * `config` is the Turnstile slice, minus the public site key: the verifier never sees the
 * EmailJS keys, and does not need the key the widget uses.
 */
export function createTurnstileVerifier(
  config: Pick<ContactConfig['turnstile'], 'secretKey' | 'verifyUrl'>,
  fetchImpl: Fetch = globalFetch,
): TurnstileVerifier {
  const url = config.verifyUrl ?? TURNSTILE_VERIFY_URL;

  return async (token, remoteIp) => {
    if (token.length > MAX_TOKEN_LENGTH) {
      return false;
    }

    // URLSearchParams encodes every value, so a crafted token stays the one `response`
    // field instead of adding or overriding another.
    const form = new URLSearchParams({
      secret: config.secretKey,
      response: token,
    });
    if (remoteIp) {
      form.set('remoteip', remoteIp);
    }

    const response = await postToProvider('Turnstile', fetchImpl, url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (response.status !== 200) {
      throw new ProviderFailure(`Turnstile answered HTTP ${response.status}`, {
        status: response.status,
      });
    }

    const answer = await readAnswer(response);

    if (typeof answer !== 'object' || answer === null) {
      return false;
    }

    const { success, 'error-codes': errorCodes } = answer as {
      success?: unknown;
      'error-codes'?: unknown;
    };

    // Only a boolean `true` verifies, whatever `error-codes` says next to it.
    if (success === true) {
      return true;
    }

    const code = firstFaultCode(errorCodes);
    if (code !== undefined) {
      throw new ProviderFailure(
        `Turnstile answered with the error code ${code}`,
        { code },
      );
    }

    // An unknown code proves nothing about the token, so it is logged instead of being
    // mistaken for a rejected token. The code is Turnstile's text: it goes in no message and
    // no property, and the error carries no detail, so the line has no suffix.
    if (listsUnknownCode(errorCodes)) {
      throw new Error(
        'Turnstile answered with an error code the Worker does not know',
      );
    }

    return false;
  };
}
