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
 * then by slug ascending. The slug tie-break exists because `Array.prototype.sort` is
 * stable but two projects can share the same `date` (see `expresion-latina` and
 * `pysa`): without an explicit tie-break, their relative order would silently depend
 * on the content loader's file enumeration order, which is not guaranteed sorted and
 * could differ across environments. Drafts are excluded unless `includeDrafts` is set.
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

    return a.slug.localeCompare(b.slug);
  });

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}
