// Thin composition root for robots.txt: it hands the site's address to the pure
// `buildRobotsTxt` (src/shared/seo/robots-txt.ts), which owns what the file says.
import type { APIRoute } from 'astro';

import { buildRobotsTxt } from '../shared/seo/robots-txt';

// Built once: the body depends on `site` alone, so the build writes `dist/client/robots.txt`
// and the Worker serves it as a static asset, with no work per request. The header below
// only applies where the route renders on demand (`astro dev`): a static file gets its type
// from its extension.
export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error(
      'astro.config.mjs must set "site" so robots.txt can name the sitemap by its absolute URL.',
    );
  }

  return new Response(buildRobotsTxt(site.href), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
