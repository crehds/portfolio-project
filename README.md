# Carlos Rodríguez Huerta · Portfolio

Personal portfolio of a full-stack web developer, rebuilt with Astro 7 to be fast, accessible,
bilingual (EN/ES) and shareable by URL.

> **Status:** rebuild in progress. The previous React version is preserved at the `v1-legacy` git tag.

## Quick start

Requires Node.js 22.12 or newer and pnpm. The project pins Node 24 in `.nvmrc`; run your version
manager's equivalent of `nvm use` to match it.

```sh
pnpm install
pnpm dev
```

The dev server runs at http://localhost:4321.

## Scripts

| Command               | What it does                                                 |
| --------------------- | ------------------------------------------------------------ |
| `pnpm dev`            | Start the dev server                                         |
| `pnpm build`          | Build the production site into `dist/`                       |
| `pnpm preview`        | Serve the production build locally                           |
| `pnpm check`          | Generate the Worker types, then type-check the code          |
| `pnpm lint`           | Lint the codebase with ESLint                                |
| `pnpm lint:fix`       | Lint and auto-fix what ESLint can                            |
| `pnpm format`         | Format the codebase with Prettier                            |
| `pnpm format:check`   | Check formatting without writing changes                     |
| `pnpm test`           | Run unit tests with Vitest                                   |
| `pnpm test:e2e`       | Run end-to-end and accessibility tests with Playwright       |
| `pnpm lighthouse`     | Run Lighthouse CI on the built preview (port 4341)           |
| `pnpm e2e:seed`       | Fill the local R2 bucket with the test CVs (e2e runs it)     |
| `pnpm generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |

The end-to-end tests start their own site on port 4331 and fake EmailJS and Turnstile servers on
4332, never reuse a server that is already running, and never reach a real provider; if either
port is busy the run stops at the start. See
[`docs/contact-setup.md`](docs/contact-setup.md#end-to-end-tests).

## Stack

| Area      | Choice                              |
| --------- | ----------------------------------- |
| Framework | Astro 7 with strict TypeScript      |
| Hosting   | Cloudflare Workers (see Deployment) |
| Content   | Astro content collections (planned) |

## Deployment

The site deploys to [Cloudflare Workers](https://developers.cloudflare.com/workers/) through
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/): Cloudflare watches the
GitHub repository and runs a build + deploy on every push to a connected branch, no CLI step
required.

- The Worker name configured in the Cloudflare dashboard must match `name` in `wrangler.jsonc`
  (`portfolio-project`), or builds fail.
- `main` is the production branch; every other connected branch gets its own preview URL.
- `main` currently serves the legacy React app. Production switches to this Astro rebuild at
  launch (T14).
- The build image reads the Node version from `.nvmrc` automatically. pnpm defaults to an older
  version there, so the dashboard's build environment variables must set `PNPM_VERSION` to the
  version pinned in `packageManager` in `package.json` (currently `12.3.4`), not a literal copy
  that can drift from it.
- The CV PDFs are served from the R2 bucket `portfolio-cv`, bound as `CV_BUCKET`. The bucket
  must exist before a branch that declares the binding deploys; the owner's setup is in
  [`docs/contact-setup.md`](docs/contact-setup.md).

## Security headers

Every response carries a Content-Security-Policy, HSTS (`max-age=31536000`, no `includeSubDomains`
or `preload` until there is a custom domain), `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin` and `X-Frame-Options: DENY`. There
is no COEP: it would block Turnstile's frame. The single source is
[`src/shared/security/headers.ts`](src/shared/security/headers.ts); it reaches the browser by two
paths, because Workers static assets apply `_headers` only to the responses they serve themselves:

| What                                                          | Where the headers come from                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Prerendered pages, the 404s, assets                           | [`public/_headers`](public/_headers), one `/*` rule (the adapter appends its immutable `Cache-Control` for `/_astro/*`) |
| Contact pages (`/contact`, `/es/contact`) and the Action POST | [`src/middleware.ts`](src/middleware.ts), with the contact policy, which also names Turnstile                           |
| `/cv/<locale>.pdf`                                            | the same middleware, with `default-src 'none'; frame-ancestors 'none'`; its own headers are kept                        |

Pages are prerendered, so the policy trusts inline scripts by hash, not by nonce. Three `is:inline`
scripts run: the theme script in `BaseLayout.astro`, the toggle's in `ThemeToggle.astro` and the
widget-theme one in `ContactForm.astro`. Styles may be inline (`style-src 'unsafe-inline'`); scripts
stay strict.

**Changing an inline script.** Any edit to its text, even whitespace, changes its hash.
`pnpm build && pnpm test:e2e e2e/csp-hashes.spec.ts` fails with the line to use
(`add 'sha256-...'`); put that hash in the constant of the same script in `headers.ts`. If
`public/_headers` is now stale, the unit test `pnpm test src/shared/security` fails; regenerate it
with `node --experimental-strip-types -e "import('./src/shared/security/headers.ts').then(m => require('fs').writeFileSync('public/_headers', m.renderHeadersFile()))"`.
A new inline script needs a new constant and an entry in the policy that serves its page. Every
browser spec also fails if its page breaks the policy (`e2e/support/csp-guard.ts`, which settles in-flight
violations before it checks).

**Manual check on the deployed preview** (the real Turnstile cannot load in the hermetic tests):
open `/contact/` on the preview, with the browser console open. The widget must draw and solve,
the console must show no "Refused to ..." message, and a submission must go through. Then
`curl -sI` the home page, the contact page and `/cv/en.pdf` and compare their headers with the
table above.

## Link check

`e2e/links.spec.ts` crawls every page in the served sitemap plus the two 404s: each same-origin link and resource must answer 200, each `#fragment` must match an `id`, and `mailto:`/`tel:` must be well formed. A link to another site must be https and its host must be listed in [`src/shared/links/external-hosts.ts`](src/shared/links/external-hosts.ts): to link to a new site, add its host there. External sites are never requested.

## Lighthouse CI

`pnpm lighthouse` audits the built site with Lighthouse (the mobile form factor, Lighthouse's default), 3 runs per page, and CI runs it as its own job. Build first (`CLOUDFLARE_ENV=e2e pnpm build`, as the e2e run does); the script then seeds the local R2 bucket and serves the preview on port 4341 itself. Chrome comes from the machine, or from `CHROME_PATH` (Playwright's Chromium works).

The pages are the paths in [`lighthouse/urls.mjs`](lighthouse/urls.mjs): both locales, the home pages, the projects list, a project page per locale, experience, skills and contact. A unit test keeps every path inside the pages the site publishes, read from `src/pages` and the project frontmatter (the sitemap itself only exists after a build). The 404 pages are not audited: Lighthouse refuses a page that answers with a 4xx status.

The median of the 3 runs must score 1 in Accessibility, Best Practices and SEO (an error otherwise), and at least 0.95 in Performance (a warning for now; it becomes an error once CI numbers exist). Turnstile's host (`challenges.cloudflare.com`) is blocked during the run so the widget does not move the scores. The settings are in [`lighthouserc.cjs`](lighthouserc.cjs). The reports are written to `.lighthouseci/` (ignored by git) and kept as the `lighthouse-reports` artifact of the CI run; nothing is uploaded to a remote host.

## Roadmap

The rebuild plan, decisions and progress live in
[`odd/tasks/portfolio-astro-rebuild.md`](odd/tasks/portfolio-astro-rebuild.md).

## License

The code is released under the [MIT License](LICENSE). Personal content (texts, images and CV)
is © Carlos Rodríguez Huerta, all rights reserved.
