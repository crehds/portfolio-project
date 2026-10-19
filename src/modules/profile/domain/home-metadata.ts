// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../../../shared/i18n/locales';

/** The profile fields the home page's metadata is made of (see `profileSchema`). */
export interface HomeMetadataProfile {
  name: string;
  role: Record<Locale, string>;
  headline?: Record<Locale, string>;
}

export interface HomeMetadata {
  title: string;
  description: string;
}

/**
 * The home page's `<title>` and meta description in a locale, made of what the profile
 * already says and nothing else, so they cannot drift from the hero they summarize or state
 * anything new: "Name — Role" for the title (the same em dash the other titles use, with the
 * name first because the page is the person), and "Role. Headline" for the description, the
 * role alone when the profile has no headline.
 */
export function homeMetadata(
  profile: HomeMetadataProfile,
  locale: Locale,
): HomeMetadata {
  const role = profile.role[locale];
  const headline = profile.headline?.[locale];

  return {
    title: `${profile.name} — ${role}`,
    description: headline ? `${role}. ${headline}` : `${role}.`,
  };
}
