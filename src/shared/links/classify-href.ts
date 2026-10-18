// Pure domain logic: no Astro/Zod imports.

/** What a link points at, reduced to what the link check needs to judge it. */
export type ClassifiedHref =
  /**
   * A page or file of this site, as a path with its query. `fragment` is the id the link
   * needs on its target, or `null` when it needs none (no fragment, `#`, or `#top`).
   */
  | { kind: 'internal'; path: string; fragment: string | null }
  /** A `mailto:` link: what follows the scheme (the addresses, then any `?headers`). */
  | { kind: 'mailto'; value: string }
  /** A `tel:` link: what follows the scheme. */
  | { kind: 'tel'; value: string }
  /** An address on another host. `host` includes a port, if there is one. */
  | { kind: 'external'; protocol: string; host: string }
  /** A scheme the site has no use for (`javascript:`, `data:`, `ftp:`, ...). */
  | { kind: 'other'; protocol: string }
  /** Something a browser cannot parse as a link at all. */
  | { kind: 'invalid' };

/**
 * Sorts a link by where it leads, the way a browser reads it: resolved against `pageUrl`,
 * the address of the page that holds it. An absolute address on the site's own origin
 * (`siteUrl`) is internal: a canonical link, an hreflang alternate or a social card names the
 * site by its public address, and `isExternalHref` would call those external.
 */
export function classifyHref(
  href: string,
  pageUrl: string,
  siteUrl: string,
): ClassifiedHref {
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return { kind: 'invalid' };
  }

  if (url.protocol === 'mailto:') {
    return { kind: 'mailto', value: url.pathname + url.search };
  }
  if (url.protocol === 'tel:') {
    return { kind: 'tel', value: url.pathname + url.search };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'other', protocol: url.protocol };
  }
  if (url.origin !== new URL(siteUrl).origin) {
    return { kind: 'external', protocol: url.protocol, host: url.host };
  }
  return {
    kind: 'internal',
    path: url.pathname + url.search,
    fragment: fragmentOf(url.hash),
  };
}

/**
 * The id a fragment looks for, decoded the way the browser matches it. An empty fragment and
 * `top` (in any case) scroll to the top of the document and need no element.
 */
function fragmentOf(hash: string): string | null {
  const raw = hash.slice(1);
  if (raw === '' || raw.toLowerCase() === 'top') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A stray `%`: the browser keeps the text as written.
    return raw;
  }
}
