// Pure domain logic: no Astro/Zod imports.

/**
 * Builds a `wa.me` deep link from a profile's E.164 WhatsApp number (e.g.
 * "+51970791041", see `profileSchema`'s `whatsapp: z.e164()` field): `wa.me` requires
 * bare digits, with no leading "+" or other formatting.
 */
export function whatsappLink(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}
