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
  kind: 'personal',
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

  it('requires a kind, either freelance or personal', () => {
    const withoutKind: Record<string, unknown> = { ...validProject };
    delete withoutKind.kind;

    expect(() => schema.parse(withoutKind)).toThrow();
    expect(() => schema.parse({ ...validProject, kind: 'client' })).toThrow();
    expect(schema.parse({ ...validProject, kind: 'freelance' }).kind).toBe(
      'freelance',
    );
    expect(schema.parse({ ...validProject, kind: 'personal' }).kind).toBe(
      'personal',
    );
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
});
