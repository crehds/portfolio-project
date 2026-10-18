// Pure domain logic: no Astro/Zod imports.

/**
 * The hosts the site may link to (`e2e/links.spec.ts` fails on any other). Each is the exact
 * host of a link in the profile or in a project's `links`; a subdomain is a host of its own,
 * so a new project site on `vercel.app` is added by name, not by a wildcard that would let
 * any address on that platform through. To link to a new site, add its host here, in
 * lowercase and without scheme or path.
 */
export const ALLOWED_EXTERNAL_HOSTS: readonly string[] = [
  // The profile links and the WhatsApp deep link (`whatsappLink`).
  'github.com',
  'www.linkedin.com',
  'wa.me',
  // The live sites of the projects.
  'bachatealo.carlos15erh.workers.dev',
  'expresion-latina.vercel.app',
  'game-with-keyboard.vercel.app',
  'hagaloverde.vercel.app',
  'marielis.vercel.app',
  'pysa.vercel.app',
];
