// Pure domain logic: no Astro/Zod imports. This is the canonical, stable category
// vocabulary and order (a business rule); `src/modules/skills/schema.ts` (the port)
// validates each skill's category against this same list.
export const SKILL_CATEGORIES = [
  'frontend',
  'backend',
  'data',
  'devops',
  'testing',
  'tools',
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
