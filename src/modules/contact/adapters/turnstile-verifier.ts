// Pure: no `astro:*` or `cloudflare:*` import. The structural pieces below are all this
// needs from the outside, so Vitest drives it with a fake `fetch` and the composition
// root (`create-contact-deps.ts`) wires the Worker's own in.
import type { ContactConfig } from '../config';
import type { TurnstileVerifier } from '../ports';
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
const MAX_TOKEN_LENGTH = 2048;

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
 * The `TurnstileVerifier` that asks Turnstile's Siteverify endpoint, called from the
 * Worker with the secret key. It resolves:
 *
 * - `true` only for a 200 whose JSON says `success: true`, and nothing else is
 *   mistaken for it;
 * - `false` for a 200 whose `success` is anything else (Turnstile rejecting the token,
 *   an expired or spent one included), and for a token past Turnstile's 2,048-character
 *   maximum, which it does not even send;
 * - a rejection, with fixed text and at most the HTTP status, for any other status,
 *   a body that is not JSON, a network error or the timeout: Turnstile could not be asked.
 *
 * It never retries (a token is single use, so Turnstile would only call a second try a
 * duplicate), and it makes one attempt in `AbortSignal.timeout(8000)`. It checks nothing
 * of the answer's `hostname`: previews run on other hostnames than the production one.
 *
 * It logs nothing. A rejection reaches `submitContact`, which logs one fixed line and
 * fails the submission closed; a line here too would report one failure twice. A `false`
 * is an ordinary answer, not a failure, and is not logged.
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
      throw new Error(`Turnstile answered HTTP ${response.status}`);
    }

    const answer = await readAnswer(response);

    return (
      typeof answer === 'object' &&
      answer !== null &&
      (answer as { success?: unknown }).success === true
    );
  };
}
