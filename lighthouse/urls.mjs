// The pages Lighthouse CI audits, as paths on the site. One list, read by lighthouserc.cjs
// (which prefixes the preview's origin) and by urls.test.ts (which keeps it inside the pages
// the site publishes). Plain .mjs so the config can import it without a build step.
//
// Both locales, and every kind of page: the two home pages, the projects list, a project
// page per locale (two different projects, one with a cover), experience, skills and the
// contact page (the one page with a form and the Turnstile widget). The Spanish experience,
// skills and contact pages share a template with their English twins, so they add runs
// without adding coverage. The 404 pages are left out on purpose: Lighthouse refuses a page
// that answers with a 4xx status, so a run would fail before it scored anything.
export const LIGHTHOUSE_PATHS = [
  '/',
  '/es/',
  '/projects/',
  '/es/projects/',
  '/projects/pysa/',
  '/es/projects/bachatealo/',
  '/experience/',
  '/skills/',
  '/contact/',
];
