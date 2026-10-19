import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LOCALES } from '../src/shared/i18n/locales';
import { LIGHTHOUSE_PATHS } from './urls.mjs';

// The pages Lighthouse CI audits (lighthouserc.cjs) must be pages the site publishes. The
// sitemap itself only exists after a build, and CI runs this test before `pnpm build`, so
// the test rebuilds the sitemap's page list from what produces it: the page files under
// `src/pages` (a `[slug]` file stands for the published projects) and the project
// frontmatter under `src/content/projects`. It never reads `dist/`.

const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));
const PROJECTS_DIR = fileURLToPath(
  new URL('../src/content/projects', import.meta.url),
);

/** The `status` of a project's page in `locale`, from its frontmatter. */
function projectStatus(slug: string, locale: string): string | undefined {
  const source = readFileSync(
    join(PROJECTS_DIR, slug, `${locale}.md`),
    'utf8',
  ).replace(/\r\n?/g, '\n');
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';

  return /^status:\s*(\S+)/m.exec(frontmatter)?.[1];
}

function publishedSlugs(locale: string): string[] {
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => projectStatus(slug, locale) === 'published');
}

/** Every page the site publishes, as a slash-terminated path (`/es/projects/pysa/`). */
function publishedPaths(): string[] {
  const paths: string[] = [];

  for (const locale of LOCALES) {
    // English is unprefixed, every other locale lives under `src/pages/<locale>`.
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const dir = locale === 'en' ? PAGES_DIR : join(PAGES_DIR, locale);
    const sections = readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !LOCALES.some((l) => l === entry.name && l !== 'en'),
      )
      .map((entry) => entry.name);

    if (existsSync(join(dir, 'index.astro'))) paths.push(`${prefix}/`);

    for (const section of sections) {
      const sectionDir = join(dir, section);
      if (existsSync(join(sectionDir, 'index.astro'))) {
        paths.push(`${prefix}/${section}/`);
      }
      if (existsSync(join(sectionDir, '[slug].astro'))) {
        for (const slug of publishedSlugs(locale)) {
          paths.push(`${prefix}/${section}/${slug}/`);
        }
      }
    }
  }

  return paths;
}

describe('the pages Lighthouse CI audits', () => {
  const published = publishedPaths();

  it('reads a believable page list from the sources', () => {
    expect(published).toEqual(
      expect.arrayContaining(['/', '/es/', '/projects/', '/es/contact/']),
    );
    // A draft project has no page.
    expect(published).not.toContain('/projects/marielis/');
  });

  it('are 8 or 9, with no repeats', () => {
    expect(LIGHTHOUSE_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(LIGHTHOUSE_PATHS.length).toBeLessThanOrEqual(9);
    expect(new Set(LIGHTHOUSE_PATHS).size).toBe(LIGHTHOUSE_PATHS.length);
  });

  it('are all pages the site publishes', () => {
    const unknown = LIGHTHOUSE_PATHS.filter(
      (path) => !published.includes(path),
    );

    expect(unknown).toEqual([]);
  });

  it('cover both locales and each kind of page', () => {
    const covers = (pattern: RegExp) =>
      LIGHTHOUSE_PATHS.some((path) => pattern.test(path));

    expect(covers(/^\/es\//)).toBe(true);
    expect(covers(/^\/(?!es\/)/)).toBe(true);
    expect(covers(/^\/(es\/)?$/)).toBe(true);
    expect(covers(/^\/(es\/)?projects\/$/)).toBe(true);
    expect(covers(/^\/(es\/)?projects\/[^/]+\/$/)).toBe(true);
    expect(covers(/^\/(es\/)?experience\/$/)).toBe(true);
    expect(covers(/^\/(es\/)?contact\/$/)).toBe(true);
  });
});
