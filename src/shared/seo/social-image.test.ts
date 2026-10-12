import { describe, expect, it } from 'vitest';

import {
  assertCoverFitsSocialImage,
  SOCIAL_IMAGE_SIZE,
  SOCIAL_IMAGE_TRANSFORM,
} from './social-image';

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

describe('assertCoverFitsSocialImage', () => {
  it.each([
    ['exactly the size of the picture', 1200, 630],
    ['bigger than it', 1280, 800],
  ])('accepts a cover %s', (_label, width, height) => {
    expect(() =>
      assertCoverFitsSocialImage({ width, height }, 'Pysa'),
    ).not.toThrow();
  });

  // The image service never enlarges, so the picture made from a smaller cover would not have
  // the size that the tags declare. The page cannot be built with tags that say otherwise.
  it.each([
    ['narrower', 1199, 800],
    ['shorter', 1280, 629],
    ['smaller both ways', 600, 400],
  ])(
    'refuses a cover %s than the picture, naming it and both sizes',
    (_label, width, height) => {
      expect(() =>
        assertCoverFitsSocialImage({ width, height }, 'Pysa'),
      ).toThrow(
        `The cover of "Pysa" is ${width}x${height}, smaller than the 1200x630 of a link preview picture.`,
      );
    },
  );
});
