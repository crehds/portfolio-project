// Pure domain logic: no Astro imports (so Vitest exercises this without Astro).

/**
 * The size of the picture that a link preview shows, in pixels: 1200 by 630, about 1.91:1,
 * the usual size of a preview's large card. The page's tags declare it
 * (`og:image:width` and `og:image:height`).
 */
export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * How a project's cover becomes that picture, as the options of `getImage` (`astro:assets`).
 * The cover is cropped, not squeezed (`fit: 'cover'`), and from the top (`position: 'top'`):
 * it is a screenshot, and the top of a page is what shows which site it is. The format is
 * JPEG, which every preview reads.
 *
 * Astro's image service never enlarges a picture, so a cover narrower than the card or
 * shorter than it comes out smaller than the size the tags declare (a 1000x800 cover gives
 * 1000x630). Keep covers at least this big; e2e/seo.spec.ts decodes the file the build
 * writes for every project page.
 */
export const SOCIAL_IMAGE_TRANSFORM = {
  ...SOCIAL_IMAGE_SIZE,
  fit: 'cover',
  position: 'top',
  format: 'jpeg',
} as const;
