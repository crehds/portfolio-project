// Pure domain logic: no Astro/Zod imports.

// An address as mail systems take it in practice, not the whole of RFC 5322 (quoted local
// parts and comments, which no site links to): a local part of the characters mail
// providers allow, then an `@`, then two or more dot-separated labels of letters, digits and
// inner hyphens. It catches what a typo produces (no `@`, no dot, a space, an empty
// label) and nothing it should let through.
const ADDRESS =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

// E.164: a `+`, a country code that does not start with 0, and at most 15 digits in all.
// At least 7 digits keeps out a stub like `+519`. No spaces, dashes or parentheses: the
// profile stores the number in this form (`profileSchema`), and a dialer needs no
// formatting.
const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Why a `mailto:` link is malformed, or `null` when it is fine. `value` is what follows the
 * scheme: one or more comma-separated addresses (percent-encoding allowed), then optional
 * `?header=value` pairs, which are not judged.
 */
export function mailtoProblem(value: string): string | null {
  const [recipients = ''] = value.split('?');
  let decoded: string;
  try {
    decoded = decodeURIComponent(recipients);
  } catch {
    return `the address ${JSON.stringify(recipients)} has a broken percent escape`;
  }
  if (decoded === '') return 'it names no address';
  for (const address of decoded.split(',')) {
    if (!ADDRESS.test(address)) {
      return `${JSON.stringify(address)} is not a valid email address`;
    }
  }
  return null;
}

/** Why a `tel:` link is malformed, or `null` when it is fine. `value` follows the scheme. */
export function telProblem(value: string): string | null {
  return E164.test(value)
    ? null
    : `${JSON.stringify(value)} is not an E.164 number (+, then 7 to 15 digits, none of them a leading 0)`;
}

/**
 * Why a link to another site is not allowed, or `null` when it is: it must use `https:` and
 * its host must be on `allowedHosts` exactly (no subdomain or suffix match). No request is
 * made; whether the other site answers is for an online check.
 */
export function externalProblem(
  protocol: string,
  host: string,
  allowedHosts: readonly string[],
): string | null {
  if (protocol !== 'https:') {
    return `${protocol.replace(/:$/, '')} is not https (host ${host})`;
  }
  if (!allowedHosts.includes(host.toLowerCase())) {
    return `the host ${host} is not on the allowlist (src/shared/links/external-hosts.ts)`;
  }
  return null;
}
