// What the HTTP adapters share. Pure: no `astro:*` or `cloudflare:*` import, and `fetch`
// arrives as a parameter, so Vitest passes a fake and never reaches a provider.

/** The part of `fetch` the adapters use. The runtime's `fetch` and a test fake both fit. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * How long an outbound call may take, in milliseconds, before it is abandoned. Contact
 * submissions wait on these calls, so a provider that stalls must not hold one open.
 */
export const OUTBOUND_TIMEOUT_MS = 8000;

/**
 * The runtime's own `fetch`. It is looked up when a request is made, so a later stub of
 * the global is honored, and it is called as `globalThis.fetch(...)`: a runtime method
 * that loses its receiver (kept in a variable or hung on another object) fails with an
 * "Illegal invocation" error in Workers.
 * https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
 */
export const globalFetch: Fetch = (url, init) => globalThis.fetch(url, init);

/**
 * Whether `error` is the abort of the timeout signal. `AbortSignal.timeout` rejects the
 * request with a `TimeoutError`; some runtimes surface it as an `AbortError`. This signal
 * is the only thing that aborts these requests, so either name means the time ran out.
 */
export function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null | undefined)?.name;

  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * The error for a request that did not complete: fixed text naming the provider and
 * whether the time ran out, built without a word of `error`. Its message and `cause`
 * are dropped on purpose: Astro sends the message of a thrown error to the visitor's
 * browser, and a failing request often quotes its own URL, headers or body, which carry
 * a key or the visitor's text.
 */
export function requestFailure(provider: string, error: unknown): Error {
  return new Error(
    isTimeout(error)
      ? `The ${provider} request timed out after ${OUTBOUND_TIMEOUT_MS} ms`
      : `The ${provider} request failed`,
  );
}

/** The part of a request that differs from one provider to the next. */
export interface ProviderRequest {
  readonly headers: Record<string, string>;
  readonly body: string;
}

/**
 * POSTs `request` to `url` and hands back the provider's response, whatever its status:
 * what a status means is the adapter's call. It makes exactly one attempt, never retries
 * (a Turnstile token is single use, and EmailJS meters every request), gives up after
 * `OUTBOUND_TIMEOUT_MS`, and does not follow redirects, because a followed redirect can
 * turn the POST into a GET that answers 200 without the provider having done anything.
 *
 * A failed attempt rejects with `requestFailure`: fixed text, and nothing of the original
 * error.
 */
export async function postToProvider(
  provider: string,
  fetchImpl: Fetch,
  url: string,
  { headers, body }: ProviderRequest,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
  } catch (error) {
    throw requestFailure(provider, error);
  }
}
