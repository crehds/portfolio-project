import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Filesystem-only checks (no `astro:*` imports, see AGENTS.md/T06): the projects schema
// validates one Markdown file's frontmatter in isolation, so it can never see whether a
// sibling locale file is missing (the Spanish site would silently fall back to English,
// see `src/modules/projects/domain/select-for-locale.ts`) or whether a draft project was
// also marked featured (it would then be selected for the home page, see
// `src/modules/projects/domain/featured-projects.ts`, even though drafts must stay hidden).

const PROJECTS_DIR = fileURLToPath(new URL('./projects', import.meta.url));
const LOCALES = ['en', 'es'] as const;

function projectSlugs(): string[] {
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function localeFile(slug: string, locale: (typeof LOCALES)[number]): string {
  return join(PROJECTS_DIR, slug, `${locale}.md`);
}

/** Reads one top-level scalar frontmatter field (e.g. `status: draft`) as raw text. */
function readFrontmatterField(
  filePath: string,
  field: string,
): string | undefined {
  const content = readFileSync(filePath, 'utf-8');
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content)?.[1] ?? '';
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(frontmatter);
  return match?.[1].trim();
}

describe('projects content integrity', () => {
  it('has at least one project', () => {
    expect(projectSlugs().length).toBeGreaterThan(0);
  });

  it('has both en.md and es.md for every project', () => {
    const missing = projectSlugs().flatMap((slug) =>
      LOCALES.filter((locale) => !existsSync(localeFile(slug, locale))).map(
        (locale) => `${slug}/${locale}.md`,
      ),
    );

    expect(missing).toEqual([]);
  });

  it('never marks a draft project as featured', () => {
    const offenders = projectSlugs().flatMap((slug) =>
      LOCALES.filter((locale) => existsSync(localeFile(slug, locale))).filter(
        (locale) => {
          const filePath = localeFile(slug, locale);
          const status = readFrontmatterField(filePath, 'status');
          const featured = readFrontmatterField(filePath, 'featured');
          return status === 'draft' && featured === 'true';
        },
      ),
    );

    expect(offenders).toEqual([]);
  });
});
