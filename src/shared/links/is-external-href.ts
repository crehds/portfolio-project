// Pure domain logic: no Astro/Zod imports.

/**
 * Whether `href` leads to another site: an absolute `http:` or `https:` URL. Relative
 * paths (`/cv/en.pdf`, `/projects/`), fragments (`#main`), `mailto:` and `tel:` links, and
 * anything that does not parse as an absolute URL are not external, so they keep opening
 * in the same tab. The URL parser is the one a browser uses, so a scheme in capitals, or
 * whitespace around the value, reads the same way here as it does when the link is clicked.
 */
export function isExternalHref(href: string): boolean {
  try {
    const { protocol } = new URL(href);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    // Not an absolute URL (a relative path, a fragment, an empty value, ...).
    return false;
  }
}
