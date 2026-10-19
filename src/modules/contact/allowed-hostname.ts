// Pure: no imports. Which hostnames a Turnstile token may have been solved on.

/**
 * The host the Worker is served from: the production Worker and every Workers Builds
 * preview are this host or a subdomain of it (`<preview>-portfolio-project.<this>`).
 */
export const DEFAULT_ALLOWED_HOSTNAME = 'carlos15erh.workers.dev';

const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

// One DNS label as the LDH rule has it: letters, digits and inner hyphens. Case is
// folded before this runs.
const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Lowercases `value` and drops ONE trailing dot (`example.com.` is the same name as
 * `example.com`). A second dot stays, so the result is then not a plain hostname.
 */
export function normalizeHostname(value: string): string {
  const lower = value.toLowerCase();

  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/**
 * Whether `value` is a plain hostname: dot-separated ASCII labels of letters, digits and
 * inner hyphens, each at most 63 characters, 253 in all. No port, path, userinfo, scheme,
 * wildcard, space or empty label, and no trailing dot (see `normalizeHostname`).
 */
export function isPlainHostname(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_HOSTNAME_LENGTH &&
    value
      .split('.')
      .every((label) => label.length <= MAX_LABEL_LENGTH && LABEL.test(label))
  );
}

/**
 * Whether `hostname`, the one Turnstile reports in a Siteverify answer, belongs to this
 * site: `DEFAULT_ALLOWED_HOSTNAME` or one of `extraHostnames`, or a subdomain of any of
 * them. The match is on a label boundary (`evilexample.com` is not `example.com`'s
 * subdomain), ignores case and tolerates one trailing dot. Anything that is not text, or
 * not a plain hostname, is refused. `extraHostnames` are expected as `parseContactConfig`
 * gives them (plain and lowercase); an entry that is not a plain hostname matches nothing.
 */
export function isAllowedHostname(
  hostname: unknown,
  extraHostnames: readonly string[] = [],
): boolean {
  if (typeof hostname !== 'string') {
    return false;
  }

  const candidate = normalizeHostname(hostname);

  if (!isPlainHostname(candidate)) {
    return false;
  }

  return [DEFAULT_ALLOWED_HOSTNAME, ...extraHostnames].some(
    (allowed) =>
      isPlainHostname(allowed) &&
      (candidate === allowed || candidate.endsWith(`.${allowed}`)),
  );
}
