// Pure domain logic: no Astro/Zod imports.

export interface FeaturedProjectsOptions {
  /** Maximum number of projects to return, applied after sorting. */
  limit?: number;
  /** Include draft projects. Defaults to false. */
  includeDrafts?: boolean;
}

interface ProjectLike {
  /** Locale-independent (unlike `data.title`), so it is a safe tie-break key that
   * produces the same order in every locale. */
  slug: string;
  data: {
    featured: boolean;
    status: 'draft' | 'published';
    date: Date;
  };
}

/**
 * Selects and orders projects for display: featured first, then by date descending,
 * then by slug ascending, compared by UTF-16 code point rather than
 * `String.prototype.localeCompare`. The tie-break exists because `Array.prototype.sort`
 * is stable but two projects can share the same `date` (see `expresion-latina` and
 * `pysa`): without an explicit tie-break, their relative order would silently depend on
 * the content loader's file enumeration order, which is not guaranteed sorted and could
 * differ across environments. `localeCompare` would undermine that same determinism: its
 * ICU-based collation can order two slugs differently depending on the host's ICU/CLDR
 * data (e.g. it sorts "a" before "B", while code-point order sorts "B" before "a") - a
 * plain `<`/`>` comparison gives one order everywhere. Drafts are excluded unless
 * `includeDrafts` is set.
 */
export function featuredProjects<T extends ProjectLike>(
  projects: T[],
  { limit, includeDrafts = false }: FeaturedProjectsOptions = {},
): T[] {
  const visible = projects.filter(
    (project) => includeDrafts || project.data.status === 'published',
  );

  const sorted = visible.sort((a, b) => {
    if (a.data.featured !== b.data.featured) {
      return a.data.featured ? -1 : 1;
    }

    const dateDiff = b.data.date.getTime() - a.data.date.getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}
