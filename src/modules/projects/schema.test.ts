import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';

import { projectsSchema } from './schema';

// Schema contract tests don't need Astro's real image pipeline: `cover` is optional
// and omitted from the fixtures below, so a minimal stand-in cast to the real
// `SchemaContext['image']` type is enough.
const stubImage = (() =>
  z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string(),
  })) as unknown as SchemaContext['image'];

const schema = projectsSchema({ image: stubImage });

const validProject = {
  title: 'Portfolio rebuild',
  summary: 'A fast, accessible Astro portfolio.',
  stack: ['astro', 'typescript'],
  links: {
    live: 'https://example.com',
    repo: 'https://github.com/crehds/portfolio-project',
  },
  featured: false,
  status: 'published',
  date: '2026-09-28',
};

describe('projectsSchema', () => {
  it('accepts a valid project', () => {
    expect(() => schema.parse(validProject)).not.toThrow();
  });

  it('defaults featured to false when omitted', () => {
    const withoutFeatured: Record<string, unknown> = { ...validProject };
    delete withoutFeatured.featured;

    const result = schema.parse(withoutFeatured);

    expect(result.featured).toBe(false);
  });

  it('defaults status to published when omitted', () => {
    const withoutStatus: Record<string, unknown> = { ...validProject };
    delete withoutStatus.status;

    const result = schema.parse(withoutStatus);

    expect(result.status).toBe('published');
  });

  it('rejects an invalid date', () => {
    expect(() =>
      schema.parse({ ...validProject, date: 'not-a-date' }),
    ).toThrow();
  });

  it('rejects an invalid status', () => {
    expect(() =>
      schema.parse({ ...validProject, status: 'archived' }),
    ).toThrow();
  });

  it('rejects an invalid link url', () => {
    expect(() =>
      schema.parse({ ...validProject, links: { live: 'not-a-url' } }),
    ).toThrow();
  });

  describe('cover', () => {
    const cover = (width: number, height: number) => ({
      src: '/cover.png',
      width,
      height,
      format: 'png',
    });

    it('accepts a cover exactly as big as a link preview picture', () => {
      expect(() =>
        schema.parse({ ...validProject, cover: cover(1200, 630) }),
      ).not.toThrow();
    });

    it('accepts a cover bigger than a link preview picture', () => {
      expect(() =>
        schema.parse({ ...validProject, cover: cover(1280, 800) }),
      ).not.toThrow();
    });

    // The image service never enlarges, so a smaller cover would make a smaller card than
    // the size its page declares; the build fails instead.
    it.each([
      ['narrower', cover(1199, 800)],
      ['shorter', cover(1280, 629)],
      ['smaller both ways', cover(600, 400)],
    ])('rejects a cover %s than a link preview picture', (_label, small) => {
      const result = schema.safeParse({ ...validProject, cover: small });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('1200x630');
    });
  });
});
