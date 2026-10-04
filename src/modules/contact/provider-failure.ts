// Pure: no `astro:*` or `cloudflare:*` import, and nothing from `adapters/`. The domain
// imports this module and the domain never depends on an adapter, so the error type the
// adapters reject with lives here, next to the ports.

/**
 * The error codes in a Turnstile Siteverify answer that blame the request (our secret or
 * our call) or Turnstile itself, and never the visitor's token. An answer that lists one of
 * them says nothing about the token, so the verifier treats Turnstile as not asked.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (error
 * codes)
 *
 * The order is the priority the verifier uses when an answer lists several: the secret
 * outranks the request, which outranks Turnstile's own trouble, so the log names the same
 * code whatever order the answer lists them in.
 */
export const TURNSTILE_FAULT_CODES = [
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error',
] as const;

export type TurnstileFaultCode = (typeof TURNSTILE_FAULT_CODES)[number];

/**
 * The one detail a `ProviderFailure` may carry besides its message: the HTTP status the
 * provider answered with, or a Turnstile fault code. Never both.
 */
export type ProviderFailureDetail =
  | { readonly status: number; readonly code?: never }
  | { readonly code: TurnstileFaultCode; readonly status?: never };

/** Whether `value` is an HTTP status: an integer from 100 to 599. */
function isHttpStatus(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  );
}

/**
 * Whether `value` is one of `TURNSTILE_FAULT_CODES`. The code comes out of Turnstile's
 * JSON, so the type cannot vouch for it: this is the run-time check.
 */
function isFaultCode(value: unknown): value is TurnstileFaultCode {
  return (TURNSTILE_FAULT_CODES as readonly unknown[]).includes(value);
}

/**
 * What an adapter rejects with when a provider answered, but not with a success: fixed
 * text of the adapter's own plus at most one detail that is safe to print. `submitContact`
 * never logs what an error says, because a failing request can quote a key or the
 * visitor's text; this detail is the only part of an error it reads, and `failureSuffix`
 * prints it after checking it once more.
 *
 * The class keeps that detail closed. A status that is not an integer from 100 to 599 is
 * dropped, and so is a code that is not in `TURNSTILE_FAULT_CODES`. Only one detail is
 * kept, the first valid one (the status, then the code), and the class never sets a
 * `cause`, so nothing of an original error rides along.
 */
export class ProviderFailure extends Error {
  override readonly name = 'ProviderFailure';
  /** The provider's HTTP status, when it answered with a valid one. */
  declare readonly status?: number;
  /** The Turnstile fault code the answer listed, when it listed one. */
  declare readonly code?: TurnstileFaultCode;

  constructor(message: string, detail: ProviderFailureDetail) {
    super(message);

    if (isHttpStatus(detail.status)) {
      this.status = detail.status;
    } else if (isFaultCode(detail.code)) {
      this.code = detail.code;
    }
  }
}

/**
 * The text a log line appends for `error`, with its leading space: ` (HTTP 403)` for a
 * `ProviderFailure` that carries a status, ` (invalid-input-secret)` for one that carries
 * a fault code, and an empty string for anything else, a plain `Error` or a value that is
 * not an error included.
 *
 * An object that merely has a `status` or a `code` property is not trusted, and is not
 * even read: only the class vouches for what it holds. What it holds is checked again
 * here, so the suffix is always an integer status from 100 to 599 or one of
 * `TURNSTILE_FAULT_CODES`, never other text, even if an instance was changed after it was
 * built.
 */
export function failureSuffix(error: unknown): string {
  if (!(error instanceof ProviderFailure)) {
    return '';
  }

  if (isHttpStatus(error.status)) {
    return ` (HTTP ${error.status})`;
  }

  if (isFaultCode(error.code)) {
    return ` (${error.code})`;
  }

  return '';
}
