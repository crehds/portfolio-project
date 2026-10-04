// Pure: no `astro:*` or `cloudflare:*` import, and nothing from `adapters/`. The domain
// imports this module and the domain never depends on an adapter, so the error type the
// adapters reject with lives here, next to the ports.

/**
 * The one detail a `ProviderFailure` may carry besides its message: the HTTP status the
 * provider answered with.
 */
export interface ProviderFailureDetail {
  readonly status: number;
}

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
 * What an adapter rejects with when a provider answered, but not with a success: fixed
 * text of the adapter's own plus at most one detail that is safe to print. `submitContact`
 * never logs what an error says, because a failing request can quote a key or the
 * visitor's text; this detail is the only part of an error it reads, and `failureSuffix`
 * prints it after checking it once more.
 *
 * The class keeps that detail closed. A status that is not an integer from 100 to 599 is
 * dropped, and so is anything else it is handed. It never sets a `cause`, so nothing of an
 * original error rides along.
 */
export class ProviderFailure extends Error {
  override readonly name = 'ProviderFailure';
  /** The provider's HTTP status, when it answered with a valid one. */
  declare readonly status?: number;

  constructor(message: string, detail: ProviderFailureDetail) {
    super(message);

    if (isHttpStatus(detail.status)) {
      this.status = detail.status;
    }
  }
}

/**
 * The text a log line appends for `error`, with its leading space: ` (HTTP 403)` for a
 * `ProviderFailure` that carries a status, and an empty string for anything else, a plain
 * `Error` or a value that is not an error included.
 *
 * An object that merely has a `status` property is not trusted, and is not even read:
 * only the class vouches for what it holds. What it holds is checked again here, so the
 * suffix is always an integer status from 100 to 599 and never other text, even if an
 * instance was changed after it was built.
 */
export function failureSuffix(error: unknown): string {
  if (error instanceof ProviderFailure && isHttpStatus(error.status)) {
    return ` (HTTP ${error.status})`;
  }

  return '';
}
