import { describe, expect, it } from 'vitest';

import { SOCIAL_IMAGE_SIZE, SOCIAL_IMAGE_TRANSFORM } from './social-image';

describe('SOCIAL_IMAGE_SIZE', () => {
  it('is 1200 by 630 pixels, the size of a preview picture', () => {
    expect(SOCIAL_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
  });
});

describe('SOCIAL_IMAGE_TRANSFORM', () => {
  it('crops a cover to the size of a preview picture, from its top, and writes a JPEG', () => {
    // A cover is a screenshot: cropped (`cover`), not squeezed, and the top of a page is the
    // part that shows which site it is. A change to any of these is a change to every card.
    expect(SOCIAL_IMAGE_TRANSFORM).toEqual({
      width: 1200,
      height: 630,
      fit: 'cover',
      position: 'top',
      format: 'jpeg',
    });
  });

  it('has the size that the tags of the page declare', () => {
    expect(SOCIAL_IMAGE_TRANSFORM).toMatchObject(SOCIAL_IMAGE_SIZE);
  });
});
