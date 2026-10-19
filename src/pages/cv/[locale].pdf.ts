// Thin composition root for the CV download: it reads the R2 binding from the Workers
// runtime and hands everything else to the pure `serveCv` (src/modules/cv/serve-cv.ts),
// which owns the status codes, headers and logging.
import type { APIRoute } from 'astro';
// Bindings come from `cloudflare:workers`: `Astro.locals.runtime.env` was removed in the
// Cloudflare adapter v13 and throws. The `Env` type is generated from wrangler.jsonc by
// `wrangler types` (`pnpm check` runs it first).
import { env } from 'cloudflare:workers';

import { serveCv } from '../../modules/cv/serve-cv';

// On demand: the PDF lives in the R2 bucket, not in the build, so the owner can replace
// it without a deploy. This is the site's first route that does not prerender.
export const prerender = false;

export const GET: APIRoute = ({ params, request }) =>
  serveCv({ locale: params.locale, bucket: env.CV_BUCKET, request });
