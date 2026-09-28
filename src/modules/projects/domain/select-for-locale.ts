// Pure domain logic: no Astro/Zod imports. `ProjectData` is a type-only import from the
// sibling schema (erased at compile time), used here only to describe the data shape.
import { DEFAULT_LOCALE } from '../../../shared/i18n/locales';
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

function parseProjectId(id: string): { slug: string; locale: string } | null {
  const separatorIndex = id.indexOf('/');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    slug: id.slice(0, separatorIndex),
    locale: id.slice(separatorIndex + 1),
  };
}

/**
 * Picks one entry per project slug for the requested locale, falling back to the
 * default locale (and flagging `isFallback`) when that translation doesn't exist yet.
 */
export function selectProjectsForLocale(
  entries: ProjectEntry[],
  locale: Locale,
): LocalizedProject[] {
  const bySlug = new Map<string, Map<string, ProjectEntry>>();

  for (const entry of entries) {
    const parsed = parseProjectId(entry.id);
    if (!parsed) {
      continue;
    }

    const localesForSlug =
      bySlug.get(parsed.slug) ?? new Map<string, ProjectEntry>();
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
