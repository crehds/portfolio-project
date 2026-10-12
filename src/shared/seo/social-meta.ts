// Pure domain logic: no Astro imports (so Vitest exercises this without Astro).
import { LOCALES } from '../i18n/locales';
import type { Locale } from '../i18n/locales';

/**
 * A `<meta>` tag as plain data: the attributes of the tag, which the layout renders as they
 * are. Open Graph names its tags with `property`, Twitter's card type with `name`.
 */
export type SocialMetaTag =
  { property: string; content: string } | { name: string; content: string };

/**
 * Open Graph's code for each locale of the site, in its `language_TERRITORY` form
 * (https://ogp.me, `og:locale`). `es_LA` is Facebook's code for Latin American Spanish, the
 * variant the site writes in (`es-419` in `INTL_LOCALE_TAGS`), and not the Spanish of Spain
 * (`es_ES`).
 *
 * The record is keyed by `Locale`, so a locale that is added without a code here fails the
 * typecheck instead of getting no `og:locale` and no place among the alternates.
 */
export const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_LA',
};

/** The picture that a link preview shows. */
export interface SocialImage {
  /** Where it is served: an absolute URL, which is the only form a preview can fetch. */
  src: string;
  /** Its size in pixels, as the file has it. */
  width: number;
  height: number;
  /** What it shows, for those who cannot see it. */
  alt: string;
}

export interface SocialMetaInput {
  /** The locale of the page. */
  locale: Locale;
  /** The name of the site: `og:site_name`. */
  siteName: string;
  /** The page's `<title>`: `og:title`. */
  title: string;
  /** The page's meta description: `og:description`. */
  description: string;
  /** The page's canonical URL, absolute: `og:url`. */
  url: string;
  /** The picture to show. A page without one gets no picture tags and the small card. */
  image?: SocialImage;
}

/**
 * The Open Graph and Twitter tags of an indexable page: what LinkedIn, Slack, Facebook and
 * X read to draw a preview of its link.
 *
 * Every page is a `website`, called by the site's name. The title, the description and the
 * address are the page's own, and the address is its canonical one, so a share of the link
 * counts for the page that search engines index. The page's locale comes first, and each
 * other locale of the site follows as an alternate.
 *
 * The picture, when there is one, comes with its size and its alt text, and the card is the
 * large one; without a picture it is the small one, and no picture tag is written at all.
 * That is the only tag Twitter's own namespace needs here: X falls back to the Open Graph
 * tags above for the title, the description and the picture. `twitter:site` and
 * `twitter:creator` name an account, and the profile has no X handle to name.
 *
 * The text is returned as it is. Writing it into attributes, and so escaping it, is the
 * markup's job; escaping it here too would show twice in a preview.
 */
export function buildSocialMeta({
  locale,
  siteName,
  title,
  description,
  url,
  image,
}: SocialMetaInput): SocialMetaTag[] {
  if (image && !URL.canParse(image.src)) {
    throw new Error(
      `The social image must have an absolute address, and "${image.src}" is not one.`,
    );
  }

  return [
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: siteName },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: OPEN_GRAPH_LOCALES[locale] },
    ...LOCALES.filter((other) => other !== locale).map((other) => ({
      property: 'og:locale:alternate',
      content: OPEN_GRAPH_LOCALES[other],
    })),
    ...(image
      ? [
          { property: 'og:image', content: image.src },
          { property: 'og:image:width', content: String(image.width) },
          { property: 'og:image:height', content: String(image.height) },
          { property: 'og:image:alt', content: image.alt },
        ]
      : []),
    {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    },
  ];
}
