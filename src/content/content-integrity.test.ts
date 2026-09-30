import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cvPath } from '../modules/cv/cv-path';

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

/**
 * Reads a nested `en`/`es` pair from a top-level YAML field shaped like:
 *   field:
 *     en: value, possibly
 *       wrapped onto more lines
 *     es: value
 * Folds a wrapped scalar's continuation lines the way YAML itself would (each line
 * break becomes a single space). Only handles `profile.yaml`'s actual shape - a
 * top-level list item's fields indented 2 spaces, their `en`/`es` sub-keys indented 4
 * - so this is not a general YAML parser, just enough to compare two of its fields.
 */
function parseLocalizedField(
  content: string,
  field: string,
): { en: string; es: string } | undefined {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line === `  ${field}:`);
  if (headerIndex === -1) return undefined;

  const block: string[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i])) break; // next sibling field, or less indented
    block.push(lines[i]);
  }

  const en = foldLocalizedSubKey(block, 'en');
  const es = foldLocalizedSubKey(block, 'es');
  if (en === undefined || es === undefined) return undefined;

  return { en, es };
}

function foldLocalizedSubKey(
  block: string[],
  subKey: 'en' | 'es',
): string | undefined {
  const prefix = `    ${subKey}: `;
  const startIndex = block.findIndex((line) => line.startsWith(prefix));
  if (startIndex === -1) return undefined;

  const parts = [block[startIndex].slice(prefix.length)];
  for (let i = startIndex + 1; i < block.length; i++) {
    if (/^ {0,4}\S/.test(block[i])) break; // the other sub-key, or less indented
    parts.push(block[i].trim());
  }

  const joined = parts.join(' ').trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(joined);
  return quoted ? quoted[2] : joined;
}

describe('parseLocalizedField', () => {
  it('reads a single-line en/es pair', () => {
    const yaml =
      '  role:\n    en: Developer\n    es: Desarrollador\n  email: x\n';

    expect(parseLocalizedField(yaml, 'role')).toEqual({
      en: 'Developer',
      es: 'Desarrollador',
    });
  });

  it("folds a wrapped scalar's continuation lines into one value", () => {
    const yaml =
      '  headline:\n' +
      '    en: First line and\n' +
      '      second line.\n' +
      '    es: Primera línea y\n' +
      '      segunda línea.\n' +
      '  location:\n' +
      '    en: Lima\n';

    expect(parseLocalizedField(yaml, 'headline')).toEqual({
      en: 'First line and second line.',
      es: 'Primera línea y segunda línea.',
    });
  });

  it('returns undefined when the field is absent', () => {
    const yaml = '  role:\n    en: Developer\n    es: Desarrollador\n';

    expect(parseLocalizedField(yaml, 'headline')).toBeUndefined();
  });
});

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

  // The hero renders the role directly above the headline (see
  // `src/components/home/Hero.astro`), so a headline that repeats it verbatim reads
  // as redundant to a visitor.
  it('does not start the headline with the role text already shown above it', () => {
    const profile = readFileSync(PROFILE_FILE, 'utf-8');
    const role = parseLocalizedField(profile, 'role');
    const headline = parseLocalizedField(profile, 'headline');
    if (!role || !headline) {
      throw new Error(
        'Expected both "role" and "headline" to be present in profile.yaml.',
      );
    }

    expect(headline.en.startsWith(role.en)).toBe(false);
    expect(headline.es.startsWith(role.es)).toBe(false);
  });

  // The schema checks a `cv` value only when one is set (the field is optional), and the
  // home page shows its "Download CV" button only when it is. This pins the committed
  // content itself: both locales are set, each to the one route that serves its CV.
  it('points each locale cv at its own download route', () => {
    const profile = readFileSync(PROFILE_FILE, 'utf-8');

    expect(parseLocalizedField(profile, 'cv')).toEqual({
      en: cvPath('en'),
      es: cvPath('es'),
    });
  });
});
