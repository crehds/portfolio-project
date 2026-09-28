// Pure domain logic: no Astro/Zod imports.

export interface FeaturedProjectsOptions {
  /** Maximum number of projects to return, applied after sorting. */
  limit?: number;
  /** Include draft projects. Defaults to false. */
  includeDrafts?: boolean;
}

interface ProjectLike {
  data: {
    featured: boolean;
    status: 'draft' | 'published';
    date: Date;
  };
}

/**
 * Selects and orders projects for display: featured first, then by date descending.
 * Drafts are excluded unless `includeDrafts` is set.
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

    return b.data.date.getTime() - a.data.date.getTime();
  });

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}
