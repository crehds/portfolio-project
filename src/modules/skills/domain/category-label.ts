// Pure domain logic: no Astro/Zod imports at runtime. Both `SkillCategory` and
// `UiDictionary` are type-only imports (erased at compile time, like `Skill` in
// `./group-by-category.ts`), so this file has no runtime dependency on `astro/zod` or on
// `ui.ts`'s own code.
import type { UiDictionary } from '../../../shared/i18n/ui';
import type { SkillCategory } from './categories';

/**
 * Every category heading routes through the shared UI dictionary (AGENTS.md: every UI
 * string goes through the typed dictionary), the same way `employmentTypeLabel` routes
 * the experience module's own fixed vocabulary through it.
 */
const CATEGORY_LABEL_KEYS: Record<SkillCategory, keyof UiDictionary> = {
  frontend: 'skillCategoryFrontend',
  backend: 'skillCategoryBackend',
  data: 'skillCategoryData',
  devops: 'skillCategoryDevops',
  testing: 'skillCategoryTesting',
  tools: 'skillCategoryTools',
};

/** Resolves a skill category to its localized heading via the given UI dictionary. */
export function skillCategoryLabel(
  category: SkillCategory,
  dictionary: UiDictionary,
): string {
  return dictionary[CATEGORY_LABEL_KEYS[category]];
}
