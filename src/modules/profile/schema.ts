import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';

import { localized } from '../../shared/i18n/localized';

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
    cv: localized(z.string()).optional(),
    photo: image().optional(),
  });

export type Profile = z.infer<ReturnType<typeof profileSchema>>;
