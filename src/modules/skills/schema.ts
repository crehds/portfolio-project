import { z } from 'astro/zod';

// Kept inline for now; T04's fourth commit extracts this ordered tuple into
// `domain/categories.ts` (the canonical, stable category order) and this schema
// switches to importing it.
const SKILL_CATEGORIES = [
  'frontend',
  'backend',
  'data',
  'devops',
  'testing',
  'tools',
] as const;

/**
 * The `skills` collection's contract (port): one skill the owner lists.
 * `content.config.ts` wires this to the `file()` loader.
 */
export const skillsSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(SKILL_CATEGORIES),
  icon: z.string().optional(),
});

export type Skill = z.infer<typeof skillsSchema>;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
