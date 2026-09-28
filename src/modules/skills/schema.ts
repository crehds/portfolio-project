import { z } from 'astro/zod';

import { SKILL_CATEGORIES } from './domain/categories';

/**
 * The `skills` collection's contract (port): one skill the owner lists.
 * `content.config.ts` wires this to the `file()` loader. The category vocabulary and
 * its order are owned by `domain/categories.ts`; this schema only validates against it.
 */
export const skillsSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(SKILL_CATEGORIES),
  icon: z.string().optional(),
});

export type Skill = z.infer<typeof skillsSchema>;
export type { SkillCategory } from './domain/categories';
