// Pure domain logic: no Astro imports.

/**
 * The browser's own chrome (the address bar of a phone, the tab strip) is tinted with the
 * `theme-color` meta, which cannot read a stylesheet's custom properties, so the layout writes
 * these two values as they are: the page background of each theme. `src/styles/icons.test.ts`
 * reads `tokens.css` and fails when either one falls out of step with its token.
 *
 * Each value is for one color scheme of the operating system, through the tag's `media` query.
 * It does not follow the theme that a visitor picked with the site's toggle (a browser reads
 * the tag once, from the HTML), so a visitor who overrides the OS scheme sees the other tint.
 */
export const THEME_COLORS = {
  light: '#faf9f5',
  dark: '#161a17',
} as const;
