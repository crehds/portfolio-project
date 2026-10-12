import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';

import { SOCIAL_IMAGE_SIZE } from '../../shared/seo/social-image';

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
    // A project page shares its cover as a link preview picture. Astro's image service never
    // enlarges, so a smaller cover would give a smaller picture than the size the page's tags
    // declare; the check is on the file's own size, so the build fails instead of the tags
    // saying something the file is not.
    cover: image()
      .refine(
        ({ width, height }) =>
          width >= SOCIAL_IMAGE_SIZE.width &&
          height >= SOCIAL_IMAGE_SIZE.height,
        {
          message: `The cover must be at least ${SOCIAL_IMAGE_SIZE.width}x${SOCIAL_IMAGE_SIZE.height} pixels, the size of a link preview picture.`,
        },
      )
      .optional(),
    featured: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('published'),
    date: z.coerce.date(),
  });

export type ProjectData = z.infer<ReturnType<typeof projectsSchema>>;
