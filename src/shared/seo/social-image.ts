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
 * 1000x630). `assertCoverFitsSocialImage` is the guard: a page calls it before it declares
 * the size, so the build fails instead of the tags saying something the file is not. (The
 * `projects` content schema cannot check it: the glob loader hands `image()` a placeholder at
 * that point, and the cover's size is only known once the page has the image.)
 * e2e/seo.spec.ts decodes the file the build writes for every project page.
 */
export const SOCIAL_IMAGE_TRANSFORM = {
  ...SOCIAL_IMAGE_SIZE,
  fit: 'cover',
  position: 'top',
  format: 'jpeg',
} as const;

/**
 * Throws when a cover is smaller than the picture of a link preview (`SOCIAL_IMAGE_SIZE`), in
 * either direction. Astro's image service never enlarges, so the picture made from such a
 * cover would be smaller than the size the page's tags declare, and a preview would be told
 * something the file is not. `name` is what the error calls the project.
 */
export function assertCoverFitsSocialImage(
  cover: { width: number; height: number },
  name: string,
): void {
  if (
    cover.width < SOCIAL_IMAGE_SIZE.width ||
    cover.height < SOCIAL_IMAGE_SIZE.height
  ) {
    throw new Error(
      `The cover of "${name}" is ${cover.width}x${cover.height}, smaller than the ${SOCIAL_IMAGE_SIZE.width}x${SOCIAL_IMAGE_SIZE.height} of a link preview picture.`,
    );
  }
}
