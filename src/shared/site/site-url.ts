/**
 * The site's public origin: https, no path and no trailing slash. This is the one place that
 * names the host. `astro.config.mjs` hands it to Astro as `site`, which `BaseLayout` reads
 * (`Astro.site`) to build the absolute canonical link and hreflang alternates, so a preview
 * or a local server still points search engines at the production address. Tests import it
 * instead of spelling out the host. It is the `workers.dev` address until the site has a
 * domain (T14).
 */
export const SITE_URL = 'https://portfolio-project.carlos15erh.workers.dev';
