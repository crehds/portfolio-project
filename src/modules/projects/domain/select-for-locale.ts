// Pure domain logic: no Astro/Zod imports. `ProjectData` is a type-only import from the
// sibling schema (erased at compile time), used here only to describe the data shape.
import { DEFAULT_LOCALE, isLocale } from '../../../shared/i18n/locales';
import type { Locale } from '../../../shared/i18n/locales';
import type { ProjectData } from '../schema';

/** One entry as produced by the `glob()` loader: id shaped `<slug>/<locale>`. */
export interface ProjectEntry {
  id: string;
  data: ProjectData;
}

export interface LocalizedProject {
  slug: string;
  /** The locale the returned data is actually written in. */
  locale: Locale;
  /** True when `locale` differs from the requested locale (no translation yet). */
  isFallback: boolean;
  data: ProjectData;
}

/**
 * Parses a project entry id, requiring it to be exactly `<slug>/<locale>` with a
 * supported locale. The `glob()` loader in `content.config.ts` accepts nested Markdown
 * files (e.g. `acme/case-study/en.md`), so a misplaced or mislocaled file must fail
 * loudly here instead of silently disappearing from every locale's project list.
 */
function parseProjectId(id: string): { slug: string; locale: Locale } {
  const segments = id.split('/');
  const [slug, locale] = segments;

  if (segments.length !== 2 || !slug || !locale || !isLocale(locale)) {
    throw new Error(
      `Invalid project entry id "${id}": expected "<slug>/<locale>" with a supported locale.`,
    );
  }

  return { slug, locale };
}

/**
 * Picks one entry per project slug for the requested locale, falling back to the
 * default locale (and flagging `isFallback`) when that translation doesn't exist yet.
 */
export function selectProjectsForLocale(
  entries: ProjectEntry[],
  locale: Locale,
): LocalizedProject[] {
  const bySlug = new Map<string, Map<Locale, ProjectEntry>>();

  for (const entry of entries) {
    const parsed = parseProjectId(entry.id);

    const localesForSlug =
      bySlug.get(parsed.slug) ?? new Map<Locale, ProjectEntry>();
    localesForSlug.set(parsed.locale, entry);
    bySlug.set(parsed.slug, localesForSlug);
  }

  const result: LocalizedProject[] = [];

  for (const [slug, localesForSlug] of bySlug) {
    const exact = localesForSlug.get(locale);
    if (exact) {
      result.push({ slug, locale, isFallback: false, data: exact.data });
      continue;
    }

    const fallback = localesForSlug.get(DEFAULT_LOCALE);
    if (fallback) {
      result.push({
        slug,
        locale: DEFAULT_LOCALE,
        isFallback: true,
        data: fallback.data,
      });
    }
  }

  return result;
}
