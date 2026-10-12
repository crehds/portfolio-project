import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';

/**
 * The `projects` collection's contract (port): frontmatter for one project entry
 * loaded by `glob()` from `src/content/projects/<slug>/<locale>.md`. The Markdown
 * body itself (an optional case-study write-up) is handled by Astro's renderer, not
 * this schema. T15 will add a GitHub loader that must satisfy this same contract.
 */
export const projectsSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string().optional(),
    stack: z.array(z.string()),
    links: z.object({
      live: z.url().optional(),
      repo: z.url().optional(),
    }),
    cover: image().optional(),
    featured: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('published'),
    date: z.coerce.date(),
  });

export type ProjectData = z.infer<ReturnType<typeof projectsSchema>>;
