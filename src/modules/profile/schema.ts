import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';

import { LOCALES } from '../../shared/i18n/locales';
import { localized } from '../../shared/i18n/localized';
import { cvPath } from '../cv/cv-path';

// Each locale's CV is served by one route only (`src/pages/cv/[locale].pdf.ts`), so the
// profile can hold no other path: a typo here would ship a "Download CV" link that 404s.
// The expected values come from `cvPath`, so the route and the content cannot drift apart.
const cv = localized(z.string()).superRefine((paths, ctx) => {
  for (const locale of LOCALES) {
    if (paths[locale] !== cvPath(locale)) {
      ctx.addIssue({
        code: 'custom',
        path: [locale],
        message: `"${locale}" must be "${cvPath(locale)}", the route that serves the ${locale} CV`,
      });
    }
  }
});

/**
 * The `profile` collection's contract (port): the single source of truth for who the
 * owner is and how to reach them. `content.config.ts` wires this to the `file()` loader.
 */
export const profileSchema = ({ image }: SchemaContext) =>
  z.object({
    name: z.string(),
    role: localized(z.string()),
    email: z.email(),
    whatsapp: z.e164(),
    linkedin: z.url(),
    github: z.url(),
    headline: localized(z.string()).optional(),
    location: localized(z.string()).optional(),
    cv: cv.optional(),
    photo: image().optional(),
  });

export type Profile = z.infer<ReturnType<typeof profileSchema>>;
