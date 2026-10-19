// Lighthouse CI over the built preview: `pnpm lighthouse` (see "Lighthouse CI" in the
// README). Needs a build first, and a Chrome (CHROME_PATH, or the one the machine has).
// The URL list is an ES module (the unit test imports it too); require() loads it on Node 22.12+.
const { LIGHTHOUSE_PATHS } = require('./lighthouse/urls.mjs');

// A port of its own, apart from the e2e site (4331) and `astro dev` (4321), so that no run
// can audit a server it did not start.
const PORT = 4341;
const ORIGIN = `http://localhost:${PORT}`;

// The median of the runs decides each assertion: one slow or lucky run moves a mean or a
// minimum, but not the median of three.
const median = { aggregationMethod: 'median' };

module.exports = {
  ci: {
    collect: {
      url: LIGHTHOUSE_PATHS.map((path) => `${ORIGIN}${path}`),
      numberOfRuns: 3,
      // The same steps the e2e run takes: fill the local R2 bucket, then `astro preview` of
      // the build in `dist/` (CI builds it with CLOUDFLARE_ENV=e2e, as for the e2e run).
      startServerCommand: `pnpm e2e:seed && pnpm preview --port ${PORT}`,
      // Astro's own ready line ("Local    http://localhost:4341/"). The bare port would also
      // match pnpm's echo of the command (`$ astro preview "--port" "4341"`), which comes
      // before the server listens.
      startServerReadyPattern: `localhost:${PORT}/`,
      startServerReadyTimeout: 120_000,
      settings: {
        // Lighthouse's default is the mobile form factor (a Moto G Power on slow 4G with a
        // 4x CPU slowdown), so no `preset` is set. The contact page loads Turnstile's
        // script from Cloudflare; blocking its host keeps a third-party widget out of the
        // scores. The CSP of the contact page allows it, so only this list keeps it out.
        blockedUrlPatterns: ['*challenges.cloudflare.com*'],
        // The usual setting for headless Chrome on a CI runner. Not proven there yet (the job
        // has not run); drop it if the first run passes without it.
        ...(process.env.CI && { chromeFlags: '--no-sandbox' }),
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 1, ...median }],
        'categories:best-practices': ['error', { minScore: 1, ...median }],
        'categories:seo': ['error', { minScore: 1, ...median }],
        // A warning until the CI runner has produced numbers to set the bar from; then it
        // becomes an error (T13 in odd/tasks/portfolio-astro-rebuild.md).
        'categories:performance': ['warn', { minScore: 0.95, ...median }],
      },
    },
    upload: {
      // Reports stay on disk, in lighthouse-reports/ (CI keeps them as an artifact; the
      // folder has no leading dot because the upload step skips hidden files). Never
      // `temporary-public-storage` or a server: those publish the reports to a remote host.
      target: 'filesystem',
      outputDir: 'lighthouse-reports',
    },
  },
};
