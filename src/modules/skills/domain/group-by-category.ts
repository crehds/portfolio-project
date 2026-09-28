// Pure domain logic: no Astro/Zod imports. `Skill` is a type-only import from the
// sibling schema (erased at compile time), used here only to describe the data shape.
import type { Skill } from '../schema';
import { SKILL_CATEGORIES, type SkillCategory } from './categories';

export interface SkillsByCategory {
  category: SkillCategory;
  skills: Skill[];
}

/** Groups skills by category, in the stable `SKILL_CATEGORIES` order; empty categories are omitted. */
export function groupSkillsByCategory(skills: Skill[]): SkillsByCategory[] {
  const grouped = new Map<SkillCategory, Skill[]>();

  for (const skill of skills) {
    const bucket = grouped.get(skill.category) ?? [];
    bucket.push(skill);
    grouped.set(skill.category, bucket);
  }

  const result: SkillsByCategory[] = [];
  for (const category of SKILL_CATEGORIES) {
    const skillsInCategory = grouped.get(category);
    if (skillsInCategory) {
      result.push({ category, skills: skillsInCategory });
    }
  }

  return result;
}
