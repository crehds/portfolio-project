// Pure domain logic: no Astro/Zod imports at runtime. Both `EmploymentType` and
// `UiDictionary` are type-only imports (erased at compile time, like `Skill` in
// `../../skills/domain/group-by-category.ts`), so this file has no runtime dependency on
// `astro/zod` (via the schema) or on `ui.ts`'s own code.
import type { UiDictionary } from '../../../shared/i18n/ui';
import type { EmploymentType } from '../schema';

/**
 * Every employment type routes through the shared UI dictionary (AGENTS.md: every UI
 * string goes through the typed dictionary) instead of a standalone translation map like
 * `format-period.ts`'s "Present" label: that string only ever appears embedded inside a
 * larger formatted period, while an employment type label is shown standalone, the same
 * way any other dictionary-backed field label is (`projectLiveLabel`, `projectRepoLabel`).
 */
const EMPLOYMENT_TYPE_KEYS: Record<EmploymentType, keyof UiDictionary> = {
  'full-time': 'employmentTypeFullTime',
  'part-time': 'employmentTypePartTime',
  freelance: 'employmentTypeFreelance',
  contract: 'employmentTypeContract',
};

/** Resolves an employment type to its localized label via the given UI dictionary. */
export function employmentTypeLabel(
  type: EmploymentType,
  dictionary: UiDictionary,
): string {
  return dictionary[EMPLOYMENT_TYPE_KEYS[type]];
}
