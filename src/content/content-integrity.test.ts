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
const PROFILE_FILE = fileURLToPath(new URL('./profile.yaml', import.meta.url));
const LOCALES = ['en', 'es'] as const;
const VALID_STATUS_VALUES = new Set(['draft', 'published']);
const VALID_FEATURED_VALUES = new Set(['true', 'false']);

function projectSlugs(): string[] {
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function localeFile(slug: string, locale: (typeof LOCALES)[number]): string {
  return join(PROJECTS_DIR, slug, `${locale}.md`);
}

/**
 * Reads one top-level scalar frontmatter field (e.g. `status: draft`) from file content,
 * normalized to a bare string. Pure (no filesystem access), so it is unit-tested directly
 * below: normalizes CRLF/CR line endings to LF, drops a trailing ` # comment`, and removes
 * one pair of matching surrounding quotes. Fails closed: throws when `content` has no
 * frontmatter block at all, instead of silently treating a malformed file the same as one
 * that simply omits `field`. Returns `undefined` only when the frontmatter block exists but
 * does not declare `field`.
 */
function parseFrontmatterField(
  content: string,
  field: string,
): string | undefined {
  const normalized = content.replace(/\r\n?/g, '\n');
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);

  if (!frontmatterMatch) {
    throw new Error(
      `Expected a frontmatter block (leading "---" ... "---") to read "${field}" from.`,
    );
  }

  const rawValue = new RegExp(`^${field}:\\s*(.+)$`, 'm')
    .exec(frontmatterMatch[1])?.[1]
    .trim();
  if (rawValue === undefined) return undefined;

  const withoutComment = rawValue.replace(/\s+#.*$/, '').trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(withoutComment);

  return quoted ? quoted[2] : withoutComment;
}

/** Reads one top-level scalar frontmatter field from a project locale file on disk. */
function readFrontmatterField(
  filePath: string,
  field: string,
): string | undefined {
  return parseFrontmatterField(readFileSync(filePath, 'utf-8'), field);
}

describe('parseFrontmatterField', () => {
  // Positive control for "never marks a draft project as featured" below: proves the
  // helper actually extracts a value instead of silently no-oping on every input, which
  // would let that rule pass vacuously no matter what the content says.
  it('reads a bare scalar value', () => {
    expect(parseFrontmatterField('---\nstatus: draft\n---\n', 'status')).toBe(
      'draft',
    );
  });

  it('normalizes CRLF line endings before matching', () => {
    const crlf = '---\r\nstatus: draft\r\nfeatured: true\r\n---\r\n';

    expect(parseFrontmatterField(crlf, 'status')).toBe('draft');
  });

  it('strips one pair of matching surrounding quotes', () => {
    const quoted = '---\nstatus: "draft"\nfeatured: \'true\'\n---\n';

    expect(parseFrontmatterField(quoted, 'status')).toBe('draft');
    expect(parseFrontmatterField(quoted, 'featured')).toBe('true');
  });

  it('drops a trailing inline comment', () => {
    const commented = '---\nstatus: draft # hidden\n---\n';

    expect(parseFrontmatterField(commented, 'status')).toBe('draft');
  });

  it('returns undefined when the field is absent from the frontmatter block', () => {
    expect(
      parseFrontmatterField('---\nstatus: draft\n---\n', 'featured'),
    ).toBeUndefined();
  });

  it('throws when the file has no frontmatter block', () => {
    expect(() => parseFrontmatterField('status: draft\n', 'status')).toThrow(
      /frontmatter block/i,
    );
  });
});

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

  it('declares an explicit status and featured value for every project', () => {
    const offenders = projectSlugs().flatMap((slug) =>
      LOCALES.filter((locale) => existsSync(localeFile(slug, locale)))
        .filter((locale) => {
          const filePath = localeFile(slug, locale);
          const status = readFrontmatterField(filePath, 'status');
          const featured = readFrontmatterField(filePath, 'featured');
          return (
            !VALID_STATUS_VALUES.has(status ?? '') ||
            !VALID_FEATURED_VALUES.has(featured ?? '')
          );
        })
        .map((locale) => `${slug}/${locale}.md`),
    );

    expect(offenders).toEqual([]);
  });
});

describe('profile content integrity', () => {
  // Years of experience are computed from the experience dates (see
  // `src/modules/experience/domain/years-of-experience.ts`). A number typed into the
  // profile text goes stale and drifts from the computed value.
  it('never hand-types years of experience', () => {
    const profile = readFileSync(PROFILE_FILE, 'utf-8');

    expect(profile).not.toMatch(/\d+\s*\+?\s*(?:years?|años)/i);
  });
});
