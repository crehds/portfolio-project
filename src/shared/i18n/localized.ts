import { z } from 'astro/zod';

/**
 * Schema helper (port-side, not domain logic): wraps a Zod schema so a content field
 * must provide one value per supported locale, e.g. `localized(z.string())` requires
 * both `en` and `es` strings.
 */
export function localized<Schema extends z.ZodType>(schema: Schema) {
  return z.object({
    en: schema,
    es: schema,
  });
}
