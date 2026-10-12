# Portfolio rebuild with Astro

> ODD feature document · feature `portfolio-astro-rebuild` · created 2026-09-28
> Engram mirror: `odd/portfolio-astro-rebuild/tasks` (project `portfolio-project`)

## Objective

Replace the 2021 React 17 + Webpack course scaffold with an Astro 7 portfolio that is fast,
accessible, bilingual (EN/ES), shareable by URL, and ready to receive updates from the
owner's other projects.

## Problem

The 2026-09-27 analysis (Engram `discovery/portfolio-full-analysis`) found:

- Content that erodes trust: frozen since May 2023, hand-typed code metrics, projects without case studies.
- Structural gaps: no URL per section, no SEO/social metadata, no accessibility primitives,
  dead contact-form validation, and the course identity still in README, package.json and LICENSE.

## Why a rebuild

The critical issues are structural (routing, prerendered HTML, metadata, assets). A static-first
framework fixes them in one move, and the codebase itself proves the skills the site lists
(TypeScript, testing, Tailwind, routing).

## Authorized scope

- Authorized by the owner on 2026-09-28: rebuild the portfolio following this plan, including
  local task branches merged into `feat/astro-rebuild`.
- Needs owner approval every time: merges into `develop` or `main`, push, deploys,
  remote/dashboard setup, deleting branches or tags on the remote.
- No automatic push after each task: work stays local until the owner pushes (owner, 2026-09-28).

## Decisions

| Area | Decision |
|---|---|
| Framework | Astro 7 (7.3.5 verified), Node >= 22.12 (local 24.21), pnpm |
| Rendering | Static by default; on-demand only for the contact pages (the form posts to the page through an Astro Action) and the `/cv/<locale>.pdf` route (and Phase 4 hooks) |
| Hosting | Cloudflare Workers: static assets + `@astrojs/cloudflare` for server routes; `*.workers.dev` until a domain exists. Vercel is the fallback |
| Content | Content Layer collections with Zod schemas: schema = port, loader = adapter |
| Seams | Only where the source will change: `projects` (local, then GitHub) and contact email delivery (provider adapter) |
| i18n | `en` default at `/`, `es` at `/es/`, hreflang in the sitemap |
| Contact | Form (Astro Action -> `EmailSender` port -> EmailJS adapter, called from the Worker; Resend replaces the adapter once a domain exists) + Turnstile, required, with a honeypot and a rate limit as extra layers + WhatsApp link + mailto. Without JavaScript the page points to email and WhatsApp (owner, 2026-09-30) |
| CV download | PDFs in a Cloudflare R2 bucket, served by the Worker at the site's own URL: one per locale (`/cv/en.pdf`, `/cv/es.pdf`); the owner uploads both, so they stay out of git and update without a redeploy |
| Styling | Tailwind v4 via `@tailwindcss/vite`, Astro Fonts API, `<Picture>` with AVIF/WebP |
| Visual direction | Legacy identity, content first (owner): Ubuntu + Ubuntu Mono, self-hosted; dark `#161a17` with a cyan accent, light navy text with a blue accent; every text/background token pair meets WCAG AA (unit-tested) |
| JavaScript | Zero by default; islands only for real interactivity |
| Quality | TS strict, `astro check`, ESLint + Prettier, Vitest, Playwright + axe, Lighthouse CI, GitHub Actions |
| Commits | Conventional Commits, no AI attribution |

## Constraints and inputs

- No custom domain yet.
- Public contact data: WhatsApp +51 970 791 041, email carlos15erh@gmail.com.
- Content sources, local only and never committed: `CV - Carlos Rodríguez Huerta.pdf`, `Profile.pdf` (LinkedIn export).
- Project case studies come later: ship basic project data plus a documented template first.
- Future: the owner's projects notify the portfolio when they change (Phase 4).

## Out of scope

Blog, CMS, authentication, analytics dashboards, changes to the owner's other projects.

## TDD

- Mode: strict. Source: global CLAUDE.md ("Strict TDD Mode: enabled").
- Runners: Vitest 5 (`pnpm test`) and Playwright 1.63 + axe (`pnpm test:e2e`), introduced in T02.
- Applies from T04 (first behavior). T01-T03 are scaffold/config: their checks are build, typecheck and lint.

## Delivery

- Owner choice (2026-09-28, solo developer): no PR chain. Each task gets its own branch
  (`feat/astro-rebuild-NN-<slug>`) with progressive work-unit commits, merged with `--no-ff` into the
  integration branch `feat/astro-rebuild`. At launch (T14), `feat/astro-rebuild` merges into `develop`,
  then `develop` into `main`, both with owner approval.
- Forecast: ~4,300 authored changed lines, excluding lockfiles, generated files and the legacy removal
  (T01: deletion-only, ~2,850 authored + ~1,850 vendored asset lines).
- Running count: ~26,942 authored lines (T01 ~270 + T02 ~215 + T03 ~125 + T03b ~35 + T04 ~1,197 + T04b ~268 +
  T05 ~511 + T05b ~47 + T06 ~715 + T06b ~106 + T07 ~1,092 + T07b ~321 + T08 ~1,021 + T09 ~923 + T09b ~217 +
  T10 ~778 + T10b ~88 + T11a ~935 + T11b ~1,698 + T11c ~2,978 + T11c-b ~1,573 + T10c ~244 + T11d ~7,936 + T11e ~535 +
  T11d-b ~482 + T12a ~674 + T12b ~581 + T12c ~939 + T12e ~438, with tests, excluding lockfiles and the legacy removal; the terms before T11d sum to 15,357, so the
  earlier total of ~15,124 was an addition slip). It already passes the ~4,300 forecast, mostly from tests, the e2e
  harness and the review follow-up tasks.
- Last reviewed boundary: `233881c`, the T12e tip (the merge `fa695de` has the same tree, `0f3ef44`); the T12c record
  `811438d` was reviewed with T12e. Before that, `cddfe93`, the T12c tip (the merge `a6c6f67` has the same tree,
  `74caa55`); the T12b record `7d1d442` was reviewed with T12c. Before that, `699a9de`, the T12b tip (the merge `0dc0da1` has the same tree,
  `5b99be5`); the T12a record `d2a7f69` was reviewed with T12b. Before that, `dd9a101`, the T12a tip (the merge `bcf61fe` has the same tree,
  `d38821c`); the T12 plan record `889497d` before it was assessed passive. Before that, `ae71410`, the T11d-b tip (the merge `5f29f95` has the same tree, `8dbc3bd`); the T11e record
  `1d41d29` was reviewed with T11d-b. Before that, `f31d941`, the T11e tip (the merge `9c35533` has the same tree,
  `26ecc4a`), with the T11d record `5d56525`; and `1acfe20`, the T11d tip (the merge `4745fc1` has the same tree,
  `c10d368`): the open slice from `62f10ae` (the T11c-b and T11d-decision records, the T10c plan, T10c and its record)
  was reviewed with T11d in three slices (see T11d in Progress). Earlier, the slice from `8c0409c` (the T10 docs `1edaac9`, T10b, the T10b docs `9b0bcc4`, the T11 plan
  `e201a3c` and T11a up to `9ac381e`; medium, 1,184 lines) was skipped by the owner (2026-09-30); as with the legacy
  removal, the next slice started after it.

## Tasks

Route: inline = parent edits directly; delegated = one bounded writer subagent (writer trigger: 2+ non-trivial files).

### Phase 0 · Foundations

- [x] **T01** Tag `v1-legacy`, remove the old app, scaffold Astro 7 (TS strict, pnpm, Node pin), README + LICENSE under the owner's name, `.gitignore` (source PDFs, `.codegraph/`, `.atl/`). Route: inline (mechanical). ~150 + legacy deletion.
- [x] **T02** Quality toolchain + CI: ESLint, Prettier, Vitest, Playwright + axe, `astro check`, GitHub Actions. Also fix the README Node wording (22.12 minimum, 24 via `.nvmrc`) raised by the T01 review. Route: delegated. ~300.
- [x] **T03** Deploy: `@astrojs/cloudflare`, `wrangler.jsonc`, Workers Builds with PR previews (owner connects the repo in Cloudflare). Also, from the T02 review: e2e `webServer` runs preview only in CI (reuse the Build step output), pin GitHub Actions to commit SHAs with Dependabot updates, explain the `odd/` entry in `.prettierignore`. Route: delegated + owner action. ~100.
  Status: verified. Branch preview: https://feat-astro-rebuild-portfolio-project.carlos15erh.workers.dev/ serves
  the Astro page; production (`main`, legacy) is unchanged.
- [x] **T03b** Follow-ups from the T03 review: set `compatibility_date` to the bundled runtime's date and comment
  it and the compatibility flag in `wrangler.jsonc`; remove the `minimumReleaseAgeExclude` bypass (let pnpm
  resolve mature `wrangler`/`miniflare` versions) and comment the `allowBuilds` entries; fail fast in CI e2e when
  `dist/` is missing; drop the redundant `tsconfig` include; point the README to `packageManager` instead of a
  literal pnpm version. Route: delegated. ~60.

### Phase 1 · Content model

- [x] **T04** Collections + Zod schemas (profile, experience, projects, skills) and pure domain rules (ordering, featured projects, years of experience computed from dates). Remove Vitest `passWithNoTests` once these first unit tests land (T02 review). Route: delegated. ~350.
- [x] **T04b** Follow-ups from the T03b + T04 review: reject experience entries whose `end` precedes `start`, and
  keep `yearsOfExperience` from subtracting months for inverted or future-dated ranges (warning); parse project ids
  at the last slash and fail loudly on nested ids or unsupported locale segments; give the `formatPeriod` tests a
  literal oracle; pin the clock (`vi.setSystemTime`) in the default-`now` test. Route: delegated. ~80.
- [x] **T05** i18n: routing config, typed UI dictionary, language switcher, hreflang helpers. Route: delegated. ~250.
- [x] **T05b** Follow-ups from the T04b + T05 review: wait for navigation with the retrying `toHaveURL` in the
  switcher e2e test (a one-shot `page.url()` read could race), and cover the current-locale state (no link to the
  current page, `aria-current`). Route: inline (one test file). ~50.
- [x] **T06** Content: profile + experience from the CV/LinkedIn PDFs (EN/ES), skills, the 6 legacy projects with basic data, documented case-study template. The profile `cv` field stays empty until T11 serves the file. Route: delegated. ~450.
- [x] **T06b** Follow-ups from the T05b + T06 review and the owner's content check: make the integrity test's
  frontmatter reader fail closed (CRLF line endings, quoted values, trailing comments, missing block) and require an
  explicit `status` and `featured` in every project file; set the live URLs for expresión latina and juego con
  teclado (owner: still on Vercel). Route: delegated. ~60.

### Phase 2 · UI

- [x] **T07** Design tokens, dark/light theme (no flash, persisted, OS default), fonts, base layout (header, nav, footer, skip link, landmarks). Route: delegated. ~400.
- [x] **T07b** Follow-ups from the T06b + T07 review and the parent's readback: make the no-flash e2e test read
  `data-theme` once before first paint instead of with a retrying assertion; follow live OS theme changes while no
  choice is stored; an e2e case where a corrupted stored value falls back to the OS theme; `aria-current` for
  pathnames without the trailing slash (reuse the path normalization); fix the inline script's `.no-js` comment;
  align the main column's left edge with the header and footer on wide screens and space the heading from the
  text below it. Route: delegated. ~120.
- [x] **T08** Home: hero, CTAs (form, WhatsApp, email, LinkedIn, GitHub, CV), featured projects, experience summary. The CV button renders only when the profile `cv` field is set. Route: delegated. ~300.
- [x] **T09** Projects list + `/projects/[slug]` case-study pages with optimized images. Also, from the T07b + T08
  review: compare project slugs by code point instead of `localeCompare` in the featured tie-break, and check the
  live and repository links of every featured card in the e2e test. Route: delegated. ~350.
- [x] **T09b** Follow-ups from the T09 review and the parent's readback: assert the exact featured cards on the home
  page (count and headings per locale) instead of "at least one"; check every list card's title link; check the
  `x-default` alternate on project pages; one shared `Intl` locale map for every date formatter (neutral `es-419`;
  today project dates use `es-PE`, "setiembre", while experience periods use `es`); a visible current-page marker
  in the nav. Route: delegated. ~120.
- [x] **T10** Experience timeline + skills page. Route: delegated. ~250.
- [x] **T10b** Follow-ups from the T09b + T10 review and the parent's readback: make the two ICU-dependent date
  oracles tolerant (assert "septiembre" and not "setiembre" instead of the full literal; accept "sep" or "sept" in
  the short month) or pin the runtime's ICU; tighten the gap between the experience page `h1` and the years line.
  Owner answers: keep the years line on the experience page and the Spanish wording ("Habilidades", "Tiempo
  completo", "Medio tiempo"). Route: delegated (writer trigger: the e2e spacing test and the page component), plus
  the parent's inline TZ-restore fix in one test file. ~60.
- [x] **T10c** External links open in a new tab (owner, 2026-10-04, after looking at the site locally): the footer's
  GitHub and LinkedIn, the live and repository links of project cards and project pages, and the home's WhatsApp,
  LinkedIn and GitHub CTAs get `target="_blank"` and `rel="noopener"`, plus a visually hidden, localized "opens in a
  new tab" hint in each link's accessible name. Internal links, `mailto:` and the CV download stay in the same tab (a
  new tab would break the back button, or stay blank for a mail client or a download). One link component and one
  pure "is external" rule; an e2e check over every page. Route: delegated (writer trigger: the link component and the
  e2e spec, plus mechanical swaps in four components). ~250.
- [ ] **T10d** Dark theme color adjustments (owner, 2026-10-04: "that light blue", the cyan accent, needs work; later,
  not now). Every text/background token pair must still meet WCAG AA (the token contrast test). Optionally with the
  heading-spacing rhythm noted in T10b. Route: decided when the owner gives the direction.
- [x] **T11** Contact: form via Astro Action (Zod validation), `EmailSender` port + EmailJS adapter, Turnstile + honeypot +
  rate limit, WhatsApp + mailto, CV download (R2), 404 page. Planned on 2026-09-30 by a read-only planning pass (see the
  change log) as five sub-tasks, each on its own branch `feat/astro-rebuild-11<x>-<slug>`. ~2,500-3,000 with tests and
  the e2e harness (the first estimate was ~450).
  - [x] **T11a** CV download via R2, the first on-demand route: `/cv/<locale>.pdf` streams `en.pdf`/`es.pdf` from the
    `CV_BUCKET` binding (bucket `portfolio-cv`); 404 for an unknown locale, a missing binding or a missing object; 304 on
    `If-None-Match`; an `attachment` with a named file, `noindex`. The profile `cv` field is set per locale, so the home
    CV button renders. Local R2 seeded with fixture PDFs for e2e; `wrangler types` runs before `astro check`; `.dev.vars`
    ignored. Route: delegated. Owner, before the first push: create the bucket and upload both PDFs.
  - [x] **T11b** Contact core, pure: the form schema (name, email, message, honeypot, Turnstile token, locale; stable
    error codes), the `EmailSender` port, a config parser that reports names and never values, and `submitContact`
    (schema, then honeypot with a silent success, rate limit, Turnstile, send); the rate-limit key comes from
    `cf-connecting-ip` only. Route: delegated.
  - [x] **T11c** Adapters tested with a mocked `fetch`: EmailJS sender, Turnstile verifier, Workers rate limiter (fails
    open on binding errors), dependency wiring; 8 s timeouts; no secret in any error text. Route: delegated. Also, from
    the T11b readback: reject control characters in `name` (`invalid`), cap the Turnstile token at 2,048 characters in
    the verifier (no call past it), and accept `http:` seam URLs only for loopback hosts.
  - [x] **T11c-b** Follow-ups from the T11c writer's open questions (parent decision): (1) Turnstile answers whose error
    codes are operator or provider faults (`missing-input-secret`, `invalid-input-secret`, `bad-request`,
    `internal-error`) reject as "could not be asked", so `submitContact` logs its fixed line (today a wrong
    `TURNSTILE_SECRET_KEY` fails every submission without a log line); token errors still resolve `false`; (2) a typed
    provider error (`ProviderFailure`) with fixed text and at most one detail, the numeric HTTP status or, for (1), the
    Turnstile fault code from that fixed list, which `submitContact` appends to its fixed log line (`(HTTP 403)`,
    `(invalid-input-secret)`; still no secret and no visitor text). Turnstile's docs give no HTTP status for an error
    answer, and a fault code that arrives in a 200 would log a useless "HTTP 200", so the code rides in the error
    instead (parent, 2026-10-04). After the readback, (3) a string code outside Cloudflare's table rejects without
    detail, so it is logged without printing Turnstile's text (parent, 2026-10-04). The hostname check goes to T13
    (allow `carlos15erh.workers.dev` and its subdomains). Route: delegated (writer trigger: the failure type, two
    adapters, `submitContact`, their tests and the setup docs). ~200 forecast, ~1,573 actual (tests ~1,217).
  - [x] **T11d** Contact page, Action and form (EN/ES), in four commits: the hermetic e2e harness (fake EmailJS and
    Turnstile server, `.dev.vars.e2e`, `CLOUDFLARE_ENV=e2e`) with the page shell, nav item and home form CTA; the action
    and form (303 to `?sent=1` on success, localized field errors with the values kept); the Turnstile widget and the
    honeypot; the no-JS and "form unavailable" notices, axe. Route: delegated. Owner, before live checks: EmailJS
    (service, template, non-browser API, keys), the Turnstile widget and keys, Worker secrets. Owner decision
    (2026-10-04): when the verifier cannot answer (an outage or a wrong secret), the visitor gets the "form
    unavailable" notice with the email and WhatsApp links, not the rejected-token message, so `submitContact` gains an
    outcome for it (e.g. `unavailable`, with its tests). Delivered in seven commits, the last one raising the Action
    body limit to 64 KiB (see Progress).
  - [x] **T11d-b** Follow-ups from the T11d and T11e reviews, all non-blocking (delivered in eight commits, see
    Progress): the six T11d findings still true at the
    tip, and (7) below from T11e.
    (1) `e2e/external-links.spec.ts` skips the accessible-name and hint checks for every link that is not visible;
    narrow the skip to the no-JS notice's links (warning). (2) `retryOnProxyFailure` (`e2e/support/contact-test.ts`)
    retries any 5xx up to five times, so an intermittent server error at the body limit would pass unseen; count or
    log the retries. (3) The axe matrix waits for a fresh rate-limit window before all 32 state tests; only the
    rate-limited state needs it. (4) The global teardown should fail the run when the fake upstreams recorded
    unexpected calls (`e2e/global-setup.ts`). (5) Rename the `rejected` verification verdict in `submit-contact.ts`:
    it reads like the rejected verifier promise, which means `unavailable`. (6) Share the direct-contact button
    between `DirectContactLinks.astro` and `ContactCtas.astro` (the `LABEL_KEYS` map and the class string are copied
    today). (7) The e2e test "marks no navigation item as current" on the 404 pages cannot fail against the prerendered
    build (the page is built for `/404`, which matches no nav item); the `BaseLayout` unit test proves the guard, so
    add a comment to the e2e test or rename it. Route: decided at launch.
  - [x] **T11e** 404 pages in EN and ES (`src/pages/404.astro`, `src/pages/es/404.astro`). Route: delegated. Delivered
    in four commits (see Progress).

### Phase 3 · Launch

- [ ] **T12** SEO: meta, Open Graph/Twitter, OG images, JSON-LD Person, sitemap + robots, canonical, favicons. Planned on
  2026-10-11 by a read-only planning pass (see the change log) as six sub-tasks, each on its own branch
  `feat/astro-rebuild-12<x>-<slug>`. ~1,300 with tests (the first estimate was ~300). Parent defaults, open to the
  owner's veto: the home title and description derive from the profile (no new facts), JSON-LD stays a minimal
  `Person`, no `twitter:site` (the profile has no X handle), no web manifest (only an installable app needs one), and
  robots.txt allows every crawler.
  - [x] **T12a** (delivered in six commits, see Progress) Canonical and error pages: one shared `SITE_URL` that `astro.config.mjs` and the tests import; a pure
    `canonicalHref(pathname, site)` beside `hreflangAlternates` (absolute, built from `site` and the pathname only,
    slash-terminated, so a query such as `?sent=1` drops out and previews point at production); `BaseLayout` renders it
    on every indexable page, and on an `errorPage` renders `<meta name="robots" content="noindex">` and no canonical
    (from T11e: `/404` and `/es/404/` answer 200 as plain assets). The home title becomes `Carlos Rodríguez Huerta —
    <role>` and its description `<role>. <headline>` in both locales, replacing "Rebuild in progress"; the unused
    `rebuildNotice` key goes. Route: delegated.
  - [x] **T12b** (delivered in three commits, see Progress) `robots.txt` as a prerendered endpoint built from `site` (`User-agent: *`, `Allow: /`, the sitemap
    line) and `@astrojs/sitemap` 3.7.4 with the i18n alternates. No `Disallow: /cv/`: a robots.txt block would hide the
    `/cv/` routes' `X-Robots-Tag: noindex` from crawlers. The 404 pages stay out of the sitemap (from T11e) and the
    on-demand contact pages are in it. Route: delegated.
  - [x] **T12c** (delivered in six commits, see Progress) Open Graph and Twitter tags on every indexable page (`og:type`, `og:site_name`, `og:title`,
    `og:description`, `og:url` equal to the canonical, `og:locale` `en_US`/`es_LA` plus the other one as
    `og:locale:alternate`, `twitter:card` `summary_large_image`); project pages use their cover cropped to 1200x630
    with `getImage` as `og:image`, with its size and alt. Also, from the T12b review: a unit test for the throw in
    `withXDefaultAlternate` (an entry with locale links and no `x-default`), and the e2e robots.txt check matches the
    media type with a pattern instead of the exact header the static-asset server sets. Route: delegated.
  - [ ] **T12d** A default social card per locale (a static 1200x630 PNG in `src/assets/og/`) for every page without a
    cover, drafted from the design tokens (name and role) for the owner's approval. Generated cards are deferred: the
    adapter prerenders in workerd and leaves sharp out. Route: delegated + owner approval.
  - [x] **T12e** (delivered in eight commits, see Progress) JSON-LD `Person` on the two home pages from `profile.yaml` only (`name`, `jobTitle`, `description`,
    `url`, `image`, `sameAs` with LinkedIn and GitHub), serialized with `<` escaped. Also, from the T12c review:
    (1) the e2e finds the project cover with a selector tied to the cover instead of `main img`, which a case-study
    image in the body would break (warning); (2) the declared `og:image` size matches what `getImage` produced, or the
    build fails when a cover is smaller than 1200x630 (the content schema can enforce the minimum); (3) the
    `hreflangAlternates` spy in `sitemap-alternates.test.ts` is reset after each test instead of relying on
    `mockReturnValueOnce` running last. Route: delegated.
  - [ ] **T12f** Icons and theme color: `favicon.ico` (32 and 48 px), an `icon.svg` that follows the color scheme, a
    180 px `apple-touch-icon.png` in a new `public/`, and one `theme-color` per color scheme, tied to the tokens by a
    test. The icon is drafted for the owner's approval. Route: delegated + owner approval.
  - Order: T12a, T12b, T12c, T12e; T12d and T12f once the owner approves the drafts (after T10d if the owner changes
    the accent color first).
- [ ] **T13** Hardening: axe on every page, Lighthouse CI budgets, link check, security headers. Also, from T11c: check
  the hostname in Turnstile's answer (allow `carlos15erh.workers.dev` and its subdomains, so previews keep working).
  And from the T11d-b review: a harness test for the global teardown's wiring (a stray call to a private fake makes the
  teardown reject with the method and path, and the fake still closes). And from the T12c e2e diagnosis: back-to-back
  full e2e runs on Windows exhaust the loopback ephemeral ports (TIME_WAIT), and the preview server listens on `::1`
  only, so the IPv4 fallback is refused; the `contact-body-limit` proxy race still exhausts its retries now and then.
  Options: connection reuse in the preview proxy or the test client, listening on `127.0.0.1` too, or spacing local
  runs (measure first; Engram #513). Route: delegated. ~200.
- [ ] **T14** Launch: production deploy, analytics, final README, prune stale branches (owner approval). Route: inline + owner. ~80.

### Phase 4 · Project sync (future)

- [ ] **T15** `portfolio.json` manifest contract + GitHub loader merged into `projects`. Route: delegated. ~350.
- [ ] **T16** GitHub App + Worker `/hooks/github` (HMAC verification) -> Workers Builds deploy hook. Route: delegated + owner action. ~300.
- [ ] **T17** Optional: D1 activity log + live collection for "Recent activity". Route: delegated. ~300.

## Acceptance criteria

- Every section and project has its own URL in EN and ES; browser back/forward works.
- No stale or invented facts: years of experience derive from dates; no fabricated metrics.
- Lighthouse on key pages: Performance >= 95, Accessibility 100, Best Practices 100, SEO 100.
- Zero axe violations on every page; full keyboard navigation.
- Link previews (LinkedIn, Slack) show title, description and image.
- The contact form reaches the owner's inbox, validates on the server and rejects bots; without JavaScript, the page
  points to email and WhatsApp (owner, 2026-09-30: Turnstile has no no-JS path).
- CI green on every PR: lint, typecheck, unit, e2e, build.
- Repo identity belongs to the owner: README, LICENSE, package metadata.

## Checks per task

`pnpm lint` · `pnpm format:check` · `pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`
(available from T02; T01 ran `pnpm astro check` + `pnpm build`). Since T11a, `pnpm check` runs `wrangler types` before
`astro check`, and `pnpm astro check` alone fails without the generated Worker types; the dry run
(`pnpm exec wrangler deploy --dry-run`) lists the bindings. Scripted e2e runs need `PLAYWRIGHT_HTML_OPEN=never`, or
the HTML reporter blocks the shell after a failure.

## Progress

| Task | Status | Commit | Checks | Review |
|---|---|---|---|---|
| T01 | done (merged `fd7a95e`) | `3b9a198` removal, `4788004` scaffold, `f811b2a` license | `pnpm check`: 0 errors/warnings/hints · `pnpm build`: 1 page | Removal: accepted unreviewed by owner (too large for review). Scaffold: medium, reviewed, approved (`review-66453b14bc688b02`), 3 non-blocking suggestions |
| T02 | done (merged `a8b7f06`) | `024bfa1` lint/format, `8d1783f` tests, `b404c79` CI, `5d51829` CI token | `pnpm lint` pass · `pnpm format:check` pass · `pnpm check` 0/0/0 · `pnpm test` pass (no tests yet) · `pnpm build` 1 page · `pnpm test:e2e` 2/2 (parent re-ran: 2/2) | High (CI shell), 4 lenses, approved (`review-51c99e8eda1bea15`), 8 non-blocking findings routed to T03/T04 |
| T03 | done (merged `164019f`, pushed `52fe1a3`; GitHub CI green, Workers Builds preview green) | `fde0993` adapter + `wrangler.jsonc`, `717ea51` CI SHA pins + e2e reuse, `1bbd29d` bindings off | `pnpm lint` pass · `pnpm format:check` pass · `pnpm check` 0/0/0 · `pnpm test` pass · `pnpm build` 1 page · `pnpm test:e2e` 2/2 (parent re-ran: 2/2) · `wrangler deploy --dry-run`: no bindings | High (CI shell), 4 lenses, approved (`review-02fe771a972ded47`), 9 non-blocking findings routed to T03b |
| T03b | done (merged `f24f152`) | `d2f5faa` compat date + release-age bypass removed, `2d8ed60` CI e2e fail-fast, tsconfig, README | `pnpm install --frozen-lockfile` pass · lint · format · `pnpm check` 0/0/0 · `pnpm test` pass · build · `pnpm test:e2e` 2/2 · dry run: no bindings, no compat warning · CI fail-fast shown · parent re-ran install/build/dry run: pass | Reviewed with T04 (see T04) |
| T04 | done (merged `9a8befc`) | `5ccdb82` collections + schemas, `35e9b69` experience rules, `ab6e082` project rules, `00a7109` skill grouping | Strict TDD: RED (module not found) before GREEN per behavior · `pnpm test` 69/69 in 13 files · lint · format · `pnpm check` 0/0/0 · build · `pnpm test:e2e` (writer) · parent re-ran after merge: test 69/69, check 0/0/0 | T03b + T04 slice: medium (1,355 lines), 1 lens (reliability), approved (`review-efa911754d4ac043`), 4 non-blocking findings routed to T04b |
| T04b | done (merged `dfb0c60`) | `e876982` inverted periods, `02dab78` strict project ids, `a4a47a9` literal oracles + fixed clock | Strict TDD, RED observed per behavior (`isYearMonthAtOrAfter is not a function`; schema accepted an inverted period; years of experience 1/-4/-7 instead of 2/2/0; project-id tests expected a throw), then GREEN · `pnpm test` 83/83 · lint · format · `pnpm check` 0/0/0 · build 1 page · `pnpm test:e2e` 2/2 · parent re-ran: test 83/83 | Reviewed with T05 (see T05) |
| T05 | done (merged `d5d0926`) | `9913d05` routing + path helpers, `9f5b69a` typed dictionary, `1f54e9f` Spanish home + switcher + hreflang | Strict TDD: RED (module not found for the helpers and dictionary; 5 e2e failures before the layout, switcher and `/es/` page existed), then GREEN · `pnpm test` 102/102 in 16 files · lint · format · `pnpm check` 0/0/0 · build 2 pages · `pnpm test:e2e` 7/7 · dry run: no bindings · parent re-ran: test 102/102, build 2 pages | T04b + T05 slice: medium (814 lines), 1 lens (reliability), approved (`review-d051703996c5d922`), 2 non-blocking findings fixed in T05b |
| T05b | done (merged `062495a`) | `9c49fb1` switcher e2e: retrying URL wait + current-locale state | Test-only; mutation check: linking the current locale made both new tests fail (expected 0 links, received 1), then restored · lint · format · `pnpm check` 0/0/0 · `pnpm test:e2e` 9/9 | Reviewed with T06 (see T06) |
| T06 | done (merged `2ed745b`) | `5ff0d1e` profile, experience, skills; `f191b45` projects; `7f10bc3` case-study template; `ecc0d35` headline years guard (parent) | Integrity test RED (no project folders; missing `es.md`), then GREEN; mutation check (draft + featured -> RED); headline guard RED ("5+ years"), then GREEN · `pnpm test` 106/106 · lint · format · `pnpm check` 0/0/0 · build 2 pages without empty-collection warnings · `pnpm test:e2e` 9/9 (writer) | T05b + T06 slice: medium (805 lines), 1 lens (reliability), approved (`review-0e6b4d7ee4133333`), 2 non-blocking findings routed to T06b |
| T06b | done (merged `c3c6eef`) | `fd5b6b8` fail-closed frontmatter checks, `eb18b1a` live links | Helper tests RED (`parseFrontmatterField is not defined`), then GREEN; explicit status/featured rule teeth check (removed `status:` -> RED, restored) · `pnpm test` 113/113 · lint · format · `pnpm check` 0/0/0 · build 2 pages · `pnpm test:e2e` 9/9 · parent re-ran: test 113/113 | Reviewed with T07 (see T07) |
| T07 | done (merged `9fb1467`) | `ee381a6` tokens, Tailwind, fonts; `ad6cf9c` theme toggle; `5f1ef4d` base layout | Strict TDD, RED observed per behavior (missing modules; missing token file; e2e: 4/5 theme and 7/13 layout tests failing before the implementation), then GREEN · `pnpm install --frozen-lockfile` · lint · format · `pnpm check` 0/0/0 · `pnpm test` 157/157 · build 2 pages, 3 font files, one preload · `pnpm test:e2e` 27/27 (twice) · dry run: no bindings · parent re-ran: test 157/157, build; screenshots in both themes at 1280 and 390 px | T06b + T07 slice: medium (1,701 lines with the lockfile), 1 lens (reliability), approved (`review-526a4756c980ea7e`), 4 non-blocking findings routed to T07b |
| T07b | done (merged `5e2cf34`) | `c769721` pre-paint theme test, `daa9ce8` live OS theme, `11506d5` trailing-slash-safe `aria-current`, `c225950` column alignment + heading spacing | RED observed per behavior (e2e: deferred bootstrap -> `null` theme; OS switch ignored; 132 px column offset; 0 px heading gap; unit: missing `isStoredTheme`/`pathnamesMatch`), then GREEN · lint · format · `pnpm check` 0/0/0 · `pnpm test` 162/162 · build 2 pages · `pnpm test:e2e` 33/33 · dry run: no bindings · parent re-ran: test 162/162; inline script still static | Reviewed with T08 (see T08) |
| T08 | done (merged `fac2766`) | `3ef3908` hero + photo, `2eeecae` CTAs, `b9c61a0` featured projects + experience summary; polish: `4dccd9d` square photo, `275e458` slug tie-break, `0566f2d` full-width cards, `38800db` headline without the role, `fdaf66a` brand icons | Strict TDD, RED observed per behavior (missing modules and dictionary keys; e2e: missing hero, CTAs and sections; photo 72-80 px off square; grid 248 px short of the container; equal-date order flipped with input order; headline starting with the role), then GREEN · `pnpm install --frozen-lockfile` · lint · format · `pnpm check` 0/0/0 · `pnpm test` 188/188 · build 2 pages · `pnpm test:e2e` 55/55 · dry run: no bindings · parent re-ran: test 188/188, build; screenshots before and after the polish | T07b + T08 slice: medium (1,385 lines), 1 lens (reliability), approved (`review-dbbf3b93069d2ee1`), 2 non-blocking suggestions routed to T09 |
| T09 | done (merged `85895d5`) | `490532d` code-point tie-break + home e2e links, `6fa4e2c` covers, `ad5eb33` list page + nav entry, `a3c518d` project pages | Strict TDD, RED observed per behavior (`localeCompare` order `[a, B]` vs expected `[B, a]`; missing nav and section helpers; missing date formatter; with the new pages stashed, 26 e2e failures: 404s, missing links and alternates), then GREEN · lint · format · `pnpm check` 0/0/0 · `pnpm test` 199/199 · build 12 pages · `pnpm test:e2e` 81/81 · dry run: no bindings · parent re-ran: test 199/199, build 12 pages; screenshots of the list, a project page and the Spanish list; draft URL returns 404 | T09 slice with `8dfb6a5`: medium (954 lines), 1 lens (reliability), approved (`review-fe50adbcbf1b75cd`), 3 non-blocking findings routed to T09b |
| T09b | done (merged `dbe64c3`) | `16944ec` exact featured cards, `239c57a` every list link + `x-default`, `962a9f9` shared `es-419` date locale, `f67e22f` visible nav marker | Test-only items proven by temporary breaks (card limit 2 -> 6 failures; second card href -> failure at `.nth(1)`; `x-default` target -> failure), restored; locale: RED "23 de setiembre de 2026" vs expected "septiembre", then GREEN; nav: RED identical current/non-current styles, then GREEN in both themes · lint · format · `pnpm check` 0/0/0 · `pnpm test` 202/202 · build 12 pages · `pnpm test:e2e` 83/83 · dry run: no bindings · parent re-ran: test 202/202 | Reviewed with T10 (see T10) |
| T10 | done (merged `b4a32a2`) | `b3faac3` experience timeline page, `8c0409c` skills page | The WIP from the paused session had no recorded RED, so the writer proved each behavior by removing it: unit 5 failed (missing label modules, dictionary 28 vs 47 keys, missing nav hrefs); e2e 30 failed with the pages, nav entries and home link removed; the `h3` -> `h2` heading fix failed first in both locales; then GREEN · lint · format · `pnpm check` 0/0/0 · `pnpm test` 208/208 · build 16 pages · `pnpm test:e2e` 113/113 · dry run: no bindings · parent re-ran: test 208/208; screenshots of both pages at 1280 and 390 px in both themes | T09b + T10 slice (from `a3c518d`): medium (1,031 lines), 1 lens (reliability), approved (`review-c99f4c543b0c4fc7`), 2 non-blocking suggestions routed to T10b |
| T10b | done (merged `56594f8`) | `1d2b3b3` ICU-tolerant date oracles, `c109c3b` years line grouped with the heading, `538d575` exact TZ restore (parent) | Test-only oracles proven by temporary breaks, then restored (`es-PE`: "expected '23 de setiembre de 2026' to contain 'septiembre'" and "'ene. 2023 – set. 2023'" rejected; no `day` -> missing '23'; 2-digit year -> missing '2026'; long month -> pattern mismatch); heading gap RED 48 px in both locales (h1 margin 16 + `gap-8` 32), then GREEN 8 px with the timeline still 32 px away; TZ restore: with the UTC pin removed on a UTC-5 host, 2/4 tests failed before the fix and 4/4 after · lint · format · `pnpm check` 0/0/0 · `pnpm test` 208/208 · build 16 pages · `pnpm test:e2e` 115/115 · dry run: no bindings · parent re-ran after its fix: test 208/208, lint, format, check 0/0/0; screenshots at 1280 and 390 px in both themes | Medium, 120 lines from `8c0409c`: not due (`under_budget`); its slice was skipped by the owner (see T11a) |
| T11a | done (merged `6c345c9`) | `8a5cf33` CV path + serving rules, `be440d3` R2 route, binding and local seed, `9ac381e` profile CV link per locale | Strict TDD, RED observed per behavior (missing `cv-path`/`serve-cv` modules; 24/25 `serveCv` tests failing against a naive stub; the schema accepting other paths, 6 failures; integrity: `cv` undefined; e2e: 11/12 CV tests failing with 404 and no `no-store`; home CV link count 0 in both locales), then GREEN; 4 characterization tests after probing the server (HEAD, a past `If-Modified-Since`, `If-Unmodified-Since` -> 412, `If-Match` + `If-None-Match` -> 304), the 304/412 rule pinned by mutation (2 and 4 failures) · lint · format · `pnpm check` 0/0/0 (99 files) · `pnpm test` 250/250 · build 16 pages + Worker · `pnpm test:e2e` 131/131 · dry run: `CV_BUCKET (portfolio-cv)` + `ASSETS` · CI replay in a clean clone passed · parent re-ran: test 250/250, check 0/0/0 | Slice from `8c0409c` (T10b + T11a): medium, 1,184 lines, due (`slice_budget_reached`); skipped by the owner. Tier of the writer's commits with the review skipped: medium (999 lines) -> the writer's verification plus the parent's spot check |
| T11b | done (merged `a00b1bd`) | `28bcb2f` form schema with stable error codes, `781efa5` settings parser (names only) + docs, `427370f` rate-limit key from `cf-connecting-ip`, `1984ce8` `submitContact` + ports | Strict TDD: RED `Cannot find module` per module, then assertion-level RED against naive stubs (schema 49/66, config 51/67, rate-limit key 9/27, `submitContact` 30/41 failing), then GREEN; mutations caught (trim after the checks: 6 failures; email format before the trim: 11; logging the thrown error: 2; a truthy non-`true` verifier answer: 1; a fail-closed limiter: 2); scratch checks against Astro's real `defineAction({ accept: 'form' })` (field codes, trimmed values, the honeypot passed through) and `astro check` (`ActionAPIContext` fits `ContactContext`) · lint · format · `pnpm check` 0/0/0 (108 files) · `pnpm test` 455/455 · build 16 pages + Worker · `pnpm test:e2e` 131/131 · dry run unchanged · parent re-ran at the tip: check 0 errors, test 455/455 | T11a docs + T11b slice (from `9ac381e`): medium, 1,746 lines, 1 lens (reliability), approved with 0 findings (`review-0a3c27cc61ffca1d`) |
| T11c | done (merged `dfdd1e2`) | `42e6953` control characters in `name`, `3211882` loopback-only `http:` seams, `0ece5b3` EmailJS sender + shared HTTP policy, `6db80f8` Turnstile verifier + Workers limiter, `8fef017` `createContactDeps` + owner setup docs | Strict TDD: RED `Cannot find module` per adapter, then assertion-level RED against naive stubs (name 17 failing, seams 32, EmailJS 60/68, Turnstile 85/98, limiter 16/29, wiring 19/54), then GREEN; mutations caught (a plain `.refine` instead of the pipe: the code-order test; a raw-text host match: 16; `!response.ok` instead of `status !== 200`: 201/202/204/206; the message spread into `template_params`: 2; no `redirect`, timeout or no-`cause` rule: 9; four Turnstile mutations: 15; a lenient limiter answer or a detached `limit` call: 10; no `fetchImpl` or no binding check: 27); a short non-JSON body caught the parser's error text quoting the body · lint · format · `pnpm check` 0/0/0 (118 files) · `pnpm test` 793/793 in 38 files · build 16 pages + Worker · `pnpm test:e2e` 131/131 · dry run unchanged · parent readback of every adapter file and the schema/config diffs; parent re-ran: check 0 errors, test 793/793; the merge tree equals the reviewed tree (`7d9a216`) | T11b docs + T11c slice (from `1984ce8`): medium, 3,023 lines, 1 lens (reliability), approved with 0 findings (`review-c6c375c4f8a6bf8c`) |
| T11c-b | done (merged `3f44f9f`) | `4f1752c` the HTTP status in the log line (`ProviderFailure` + `failureSuffix`), `a27c50c` Turnstile fault codes reject, `62f10ae` unknown codes reject without detail (parent follow-up) | Strict TDD: RED `Cannot find module './provider-failure'`, then a naive stub (25/44 failing); EmailJS status 25/71, Turnstile status 18/103, `submitContact` suffix 4, composed 5 (production files stashed); the fault codes test-first, 64 failing; the unknown codes 23 failing; then GREEN; mutations caught (logging `error.message`: 60; a suffix on the limiter line: 1; duck typing instead of `instanceof`: 25; no re-check in `failureSuffix`: 10; a constructor keeping any value or both details: 24; ignoring the priority order: 9; a token code beside a fault code read as a "no": 3; the fault check before `success: true`: 4; `String(errorCodes).includes`: 4; a `cause`: 9; the unknown code in the message: 18, as a property: 7, and also logged through `error.message`: 55; the unknown check before the fault check: 6; non-strings as unknown: 2; lenient matching: 4) · lint · format · `pnpm check` 0/0/0 (120 files) · `pnpm test` 1013/1013 in 39 files · build 16 pages + Worker · `pnpm test:e2e` 131/131 · dry run unchanged · parent readback of the production diffs and the docs; Cloudflare's Siteverify table re-checked (rendered page and raw source: exactly 7 codes); parent re-ran: check 0/0/0 (120 files), test 1013/1013; the merge tree equals the reviewed tree (`8c65a64`) | T11c docs + T11c-b slice (from `8fef017`): medium, 1,637 lines, 1 lens (reliability), approved with 0 findings (`review-40b8486602bfae27`) |
| T10c | done (merged `37afe00`) | `ae999ab` the `isExternalHref` rule, `ed190c5` the `linkOpensInNewTab` hint in both dictionaries, `827036f` `Link.astro` and the migrated anchors (footer GitHub/LinkedIn, project card and page live/repo links, every home CTA) | Strict TDD: RED `Cannot find module`, then a naive `startsWith` stub (2/19 failing: `HTTPS://EXAMPLE.COM/`, a bare `https://`); dictionary pin 47 vs 48 keys in both locales; the new e2e spec 10/20 failing before the component (`target … Expected "_blank", Received ""`), then GREEN; mutations caught (no `rel`: 10; a `target` on the `mailto:` CTA: 2; no space before the hint: 10, caught by the text check; a visible hint: 10; a plain repository anchor again: 4; the hint always in English: 5; the hint hidden with `display: none`: 10) · lint · format · `pnpm check` 0/0/0 (124 files) · `pnpm test` 1032/1032 in 40 files · build 16 pages · `pnpm test:e2e` 151/151 · dry run unchanged · 40 full-page screenshots (10 pages, 1280 and 390 px, both themes) byte-identical to the base build · parent readback of the production diff; parent re-ran: check 0/0/0 (124 files), test 1032/1032; the merge tree equals the writer's tree (`7c6a402`) | Slice from `62f10ae` (records + T10c): medium, 309 lines, `under_budget`, not due; reviewed with T11d (slice A, see T11d) |
| T11d | done (merged `4745fc1`) | `ba08701` `unavailable` outcome, `00d272b` page shell + hermetic e2e harness, `23beec4` pure page-state core, `d43c37e` Action + form + Turnstile widget, `b854657` honeypot + every failure state, `a41099a` no-JS notice + the guard's runtime half + axe + layout, `1acfe20` Action body limit 64 KiB (parent follow-up) | Writer, final verification on `1acfe20`: lint · format · `pnpm check` 0 errors · `pnpm test` 1255/1255 in 48 files · `pnpm test:e2e` 383/383 three times · plain build · dry run: `CV_BUCKET`, `CONTACT_RATE_LIMIT` (3 per 60 s), `ASSETS`. The body limit test-first: unit RED (missing module), e2e RED against 32 KiB (8 failed, 1 passed), then GREEN 9/9, 25 repeats 225/225, 4 unit mutations caught; RED evidence for the first six commits is not in this record or in Engram · parent re-ran on `1acfe20` (2026-10-08): lint, format, check 0/0/0 (164 files), test 1255/1255 in 48 files, e2e 383/383 in 39.9 s, tree clean; the merge tree equals the reviewed and tested tree (`c10d368`) | The open slice from `62f10ae` plus T11d (72 files, 7,946 lines, ~361 KB of diff, high) was about three times the largest slice that has passed (T11c, ~125 KB), so it was reviewed in three slices of that size: A `62f10ae..00d272b` (records, T10c, `unavailable`, harness; high: CI shell; 41 files, 2,276 lines; 4 lenses; approved, `review-38f3aaca5c3c29e4`, 6 advisory findings), B `00d272b..d43c37e` (medium; 24 files, 3,239 lines; 1 lens, reliability; approved, `review-a045570c6bf420f1`, 3 advisory findings), C `d43c37e..1acfe20` (medium; 29 files, 2,709 lines; 1 lens, reliability; approved, `review-e737fc673b43fc0e`, 3 advisory findings). 0 blocking findings; all three granted by the owner and acknowledged. 6 of the 12 findings were already fixed by later commits (A: the 32 KiB body limit, 2 warnings, and a dangling spec reference; B: the alert and the fallback notice not rendered, 2 warnings, and their render tests); the 6 still true at the tip became T11d-b |
| T11e | done (merged `9c35533`) | `378ff97` 404 copy EN/ES, `530347d` switcher `errorPage` prop (links to the home pages), `fc7eae3` the two 404 pages + e2e, `f31d941` no current nav item on an error page (dev-mode fix) | Strict TDD: dictionary pin RED (83 vs 89 keys in both locales); switcher container tests 2/5 RED (`/es/404/` instead of `/es/`); with Astro's built-in 404, `not-found.spec` 49/49 RED; with the pages but without the flag, 18 RED (3 hreflang alternates instead of 0; the switcher at `/es/404/`) while status, `lang`, title and `h1` already passed (the `/es/404` proof); then GREEN 107/107 in the three specs; layout container test 1/6 RED (`Projects=true` when rendered for `/projects/x`), then 6/6; a mutation (a 400 px-wide block and an `img` without alt) failed 8 tests, then reverted · writer: lint · format · check 0/0/0 (170 files) · test 1266/1266 in 50 files · e2e 442/442 · build 18 pages + Worker · dry run unchanged · parent re-ran: check 0/0/0 (170 files), test 1266/1266, e2e 442/442 (21.2 s), tree clean; the merge tree equals the reviewed tree (`26ecc4a`) | Slice from `1acfe20` (the T11d record + T11e): medium, 13 files, 628 lines, 1 lens (reliability), approved with 1 advisory suggestion (`review-e4fdf0b15a6bcdd2`), routed to T11d-b |
| T11d-b | done (merged `5f29f95`) | `c9c1a4a` `refused` verdict, `6d2ffb0` shared `ContactCtaButton`, `546a320` 404 nav test renamed, `1ada384` rate-limit wait only in the rate-limited state, `093bdd1` only the no-JS notice's links excused, `0a65dd2` every proxy retry visible, `cdd365a` the teardown fails on unexpected fake calls, `ae71410` docs | Behavior changes test-first: (1) with a footer link hidden, the old spec passed 28/28 (blind) and the narrowed one failed 14 (one per page), then 28/28 restored; (2) retry tests 3/4 RED (no warning, 0 annotations), then 4/4; (4) `unexpectedCallProblems` RED (missing export), then 4/4, and a temporary stray-call spec turned exit 0 into exit 1 with the method and path named (no body or query). Refactors under green tests: (3) axe-matrix waits 32 → 4, 32/32 pass; (5) 96 `submit-contact` tests pass; (6) both lists' HTML byte-identical in both locales and the prerendered home pages byte-identical to the base build, and a wrong label is caught by the new button test · writer: lint · format · check 0/0/0 (172 files) · test 1290/1290 in 51 files · e2e 450/450 · build · dry run · parent re-ran: check 0/0/0 (172 files), test 1290/1290, e2e 450/450 (18.7 s), tree clean; the merge tree equals the reviewed tree (`8dbc3bd`) | Slice from `f31d941` (the T11e record + T11d-b): medium, 16 files, 542 lines, 1 lens (reliability), approved with 1 advisory suggestion (`review-7cb94fd344ff2eac`), routed to T13 |
| T12a | done (merged `bcf61fe`) | `d770c4a` shared `SITE_URL`, `c6ebd46` `canonicalHref`, `45ecd19` canonical link + `noindex` on error pages, `fbe615b` home title and description from the profile, `5931e31` unused dictionary keys dropped, `dd9a101` `SITE_URL` in its own module (parent follow-up) | Strict TDD: `SITE_URL` 9 unit failures before the export; `canonicalHref is not a function` (8), then a naive `site + pathname` stub (4 failing) and a default-locale mutation (4); layout container 4 RED, then 3 mutations caught (canonical from `Astro.url.origin`: 3; a canonical on error pages: 1; `noindex` on every page: 1); `e2e/seo.spec.ts` with the layout change stashed: 24 failed, 1 passed (canonical "Expected 1, Received 0"; robots meta "Expected 1, Received 0"), and its table guard against `dist/client` caught a removed slug; `homeMetadata`: Cannot find module, then a naive stub 4/4; dictionary pins 2; the move to `src/shared/site/`: 3 suites with Cannot find module · writer: lint · format · check 0/0/0 (177 files) · test 1310/1310 in 53 files · e2e 477/477 · build 18 pages · dry run unchanged (at `5931e31`) · parent readback of the production diff; parent re-ran: test 1310/1310 in 53 files; the merge tree equals the reviewed tree (`d38821c`) | Slice from `889497d` (T12a): medium, 21 files, 674 lines, 1 lens (reliability), approved with 0 findings (`review-44d421d6be6f71f9`) |
| T12b | done (merged `0dc0da1`) | `c6a6aa7` robots.txt endpoint over `buildRobotsTxt`, `a05a02c` `withXDefaultAlternate`, `699a9de` `@astrojs/sitemap` 3.7.4 with the i18n alternates and `x-default` | Strict TDD: `buildRobotsTxt` Cannot find module, then a naive stub 2/6 (a doubled slash; no throw for a site that is not absolute); e2e against the build before the change: 23 failed, 27 passed (`/robots.txt` and `/sitemap-index.xml` "Expected 200, Received 404"); `withXDefaultAlternate` module not found, then a naive stub 6/8; the sitemap with `i18n` and no `serialize`: 18 failed (no `x-default`); mutations caught (no `i18n`: 20 failures and `/es/404/` listed; `changefreq` and `priority` set: the unset-fields test; no de-duplication: 1) · writer: `pnpm install --frozen-lockfile` · lint · format · check 0/0/0 (182 files) · test 1324/1324 in 55 files · e2e 500/500 · build (`robots.txt`, `sitemap-index.xml` and `sitemap-0.xml` in `dist/client`) · dry run unchanged · parent readback of the production diff; parent re-ran: test 1324/1324 in 55 files; the merge tree equals the reviewed tree (`5b99be5`) | Slice from `d2a7f69` (the T12a record + T12b): medium, 9 files, 616 lines, 1 lens (reliability), approved with 2 advisory suggestions (`review-2d95904680bbb411`), routed to T12c |
| T12c | done (merged `a6c6f67`) | `32c1d1d` a test for the throw in `withXDefaultAlternate`, `282a526` the robots.txt media type matched by pattern (both from the T12b review), `bf32a5d` `buildSocialMeta`, `fb11627` Open Graph and Twitter tags in `BaseLayout`, `ad97769` project covers as social images, `cddfe93` `coverAltText` (parent follow-up) | Strict TDD: the new e2e against the build before the change: 18 failed (no og tags); `buildSocialMeta` Cannot find module, then a naive stub (8 failed, 2 passed), then 11/11; layout container 7 RED, then 22/22; the cover e2e 18 RED before the pages passed a picture; the T12b throw test proved by removing the throw (1 failed); mutations caught (builder 8, layout 8, e2e 3, crop constants 4); `coverAltText` Cannot find module, then a naive stub 2/3, and `dist/client` byte-identical before and after that refactor · writer: lint · format · check 0/0/0 (188 files) · test 1351/1351 in 58 files · e2e 532/532 on clean runs (see the e2e diagnosis in the change log) · build 18 pages and four 1200x630 covers · dry run unchanged · parent readback of the production diff; parent re-ran: test 1351/1351 in 58 files; the merge tree equals the reviewed tree (`74caa55`) | Slice from `7d1d442` (the T12b record + T12c): medium, 15 files, 939 lines, 1 lens (reliability), approved with 1 advisory warning and 2 suggestions (`review-a1fdb60f738d38de`), routed to T12e |
| T12e | done (merged `fa695de`) | `b284de1` a cover minimum in the content schema, reverted by `ad51935` (see the change log), `cbbe787` the `hreflangAlternates` spy reset after each test, `4640eb5` `assertCoverFitsSocialImage` (the build fails for a cover under 1200x630), `accbdd9` the cover found by its place in the article, `4424db2` `buildPersonJsonLd` + `serializeJsonLd`, `1aa4045` a `jsonLd` prop on `BaseLayout`, `233881c` the `Person` on both home pages | Strict TDD: the schema refine 3 failed / 8 passed (later reverted); `assertCoverFitsSocialImage` 5 failed (not a function); `json-ld` Cannot find module, then 1 failed on the `<` escape (it caught a real single-backslash bug); the layout `jsonLd` prop 1 failed / 23 passed; the structured-data e2e against the old build 4 failed / 19 passed; the cover guard proved on the real build with the threshold raised to 1300 (the build failed naming "Bachatealo" at 1280x800); the selector proved by a reverted mutation (a body `<img>`: the old `main img` failed 10 cover tests, the new `main article > picture > img` passed 94/94); the spy reset proved by a mutation (without `mockReset`: 1 failed) · writer: lint · format · check 0/0/0 (190 files) · test 1366/1366 in 59 files · e2e 555/555 on the first run · build · parent re-ran: check 0/0/0, test 1366/1366 in 59 files; the merge tree equals the reviewed tree (`0f3ef44`) | Slice from `811438d` (the T12c record + T12e): medium, 14 files, 438 lines, 1 lens (reliability), approved with 1 advisory warning (`review-7e1cdf503b57bd14`: `mockReset` semantics before Vitest 3; the repo runs Vitest 5.0.2, where it restores the original implementation, so no action) |

## Change log

- 2026-09-28: owner asked to keep a contact form ("more confident for some people"). T11 now ships a
  server-validated form next to WhatsApp and mailto; the site gains its first on-demand route.
- 2026-09-28: the native review could not take the legacy removal (`lens_context_budget_exceeded`: 22k
  deleted lines, ~17k from `package-lock.json`). The owner accepted it unreviewed; the review boundary
  moved past it (`3b9a198`). The legacy app stays recoverable from the `v1-legacy` tag.
- 2026-09-28: TypeScript pinned to `^6` because `@astrojs/check` 0.9.10 supports TS `^5 || ^6` (TS 7 is out).
- 2026-09-28: T01 review suggestions: README Node wording vs `.nvmrc` (fixed in T02), no CI yet (T02),
  roadmap link (false positive: the plan file is on this branch).
- 2026-09-28: the RDD stop hook reviews the whole branch against `main`. That candidate always contains the
  legacy removal, so a granted review fails on budget until the branch merges into `main`. Per-task slices
  remain the review unit.
- 2026-09-28: T02 added `@types/node@^24` (Playwright config reads `process.env` under strict `astro check`)
  and keeps `eslint-plugin-jsx-a11y` 6.10.2 despite its ESLint <= 9 peer range (works with ESLint 10;
  `eslint-plugin-astro` pairs them). The parent limited the CI token to `contents: read` before review.
- 2026-09-28: T02 review suggestions routed: double build in CI, action SHA pinning and the `odd/`
  ignore comment to T03; `passWithNoTests` removal to T04; duplicated ignore lists left optional.
- 2026-09-28: the owner created the Cloudflare Worker `portfolio-project` (Workers Builds, production branch
  `main`, https://portfolio-project.carlos15erh.workers.dev/). The Workers Builds image reads Node from `.nvmrc`
  but defaults to pnpm 10.11.1, so the owner must add the build variable `PNPM_VERSION=12.3.4`.
- 2026-09-28: the adapter's defaults declared a SESSION KV binding and an IMAGES binding that Wrangler would
  provision on the first deploy. The parent set `session: false` and `imageService: 'compile'`; the dry run
  now reports no bindings. Vitest runs without the adapter (`process.env.VITEST`) because the adapter's dev
  server conflicts with Vitest's.
- 2026-09-28: T03 review suggestions routed to the new task T03b.
- 2026-09-28: owner approved the first push (`feat/astro-rebuild` + `v1-legacy`). GitHub CI passed on its first
  run and Workers Builds produced the branch preview. The checks revealed that the repo is also connected to a
  Vercel project (`portfolio-crehds`), where the legacy site is probably live and which builds every pushed
  branch. Decide at T14 whether to retire it, redirect it, or limit its builds to `main`.
- 2026-09-28: T03b set `compatibility_date` to 2026-09-25 (the bundled workerd 1.20260925.1) and removed the pnpm
  release-age bypass: widening `wrangler` to the adapter's `^4.125.0` peer range resolves 4.141.0, which is past
  pnpm's 24h minimum release age (it needed `pnpm clean --lockfile` to re-resolve).
- 2026-09-28: the owner declined automatic pushes after each task; work stays local until the owner pushes.
- 2026-09-28: T04 conventions: import Zod from `astro/zod` (the `astro:content` re-export is deprecated in Astro 7);
  `domain/` files never import `astro:*` at runtime; the domain owns shared vocabulary (`isYearMonth`, the skill
  category order) and the schemas import it. Open for T06: the profile `cv` field shape (file path or URL) and
  whether the required projects `links` object should relax.
- 2026-09-28: the T03b + T04 slice (medium, 1,355 lines) got one reliability lens and was approved. Its 4
  non-blocking findings became T04b; the inverted-period warning goes first because it can lower the years of
  experience shown on the site.
- 2026-09-28: T04b. The schema rejects an `end` before `start`, but it has no clock, so it cannot reject an
  ongoing role that starts in the future; `yearsOfExperience` ignores such ranges instead. Project entry ids must be
  exactly `<slug>/<locale>` with a supported locale, and anything else fails the build. The Spanish short month
  renders as `ene 2023` with this ICU; the test uses a tolerant regex because CLDR data can change.
- 2026-09-28: the stop hook offered its whole-branch review (branch vs `main`: 162 files, 30,291 lines). The owner
  granted it, but START refused with `stale_target_identity` (nothing started) because the T04b writer committed
  while the question was open. It must be re-derived once the branch stops moving.
- 2026-09-28: T05. `astro.config.mjs` imports `LOCALES`/`DEFAULT_LOCALE` from `src/shared/i18n/locales.ts` (one
  source of truth; works in build, Vitest and check). `site` is the production `workers.dev` URL until a domain
  exists. `BaseLayout` derives the locale from the URL, so a page cannot pass a mismatched one, and throws if `site`
  is missing. The switcher renders the current locale as a `span` with `aria-current` and the other one as a link
  with `hreflang` and `lang`. The dictionary is typed from English, so a missing or extra Spanish key fails
  `astro check`.
- 2026-09-28: the T04b + T05 slice (medium, 814 lines) got one reliability lens and was approved. Its 2 findings
  (an e2e URL race and the untested current-locale state) became T05b, done inline.
- 2026-09-28: the owner decided the CV download (see Decisions). They first proposed S3 with "a dedicated URL";
  S3 presigned URLs expire (7 days at most), so a permanent S3 link would need a public object, and R2 fits the
  existing Cloudflare hosting.
- 2026-09-28: legacy project inventory for T06 (from `v1-legacy`): the 6 projects only had a title, a live URL, a
  repository URL and a screenshot; no descriptions or stack. Current state per the owner's project records: pysa
  (Vite + React 19, still at pysa.vercel.app), expresion-latina (legacy "eyl"; Supabase attendance module, Vercel),
  game with keyboard (React 19; repository default branch is now `main`), bachatealo (moved from GitHub Pages to
  https://bachatealo.carlos15erh.workers.dev/ with a restructured repository), hagalo verde and marielis (no
  records). The legacy "code metrics" (250 PRs, 5,436 commits, 53 code reviews, 25 issues, 1,197 Codewars) and the
  "+3 1/2 years" tagline are hand-typed, so T06 drops them (acceptance criteria: no fabricated metrics, years come
  from dates).
- 2026-09-28: T06 content. Featured (owner): juego con teclado (`game-with-keyboard`), pysa and expresión latina;
  bachatealo is published; hagalo verde and marielis stay drafts until the owner sends a one-line summary for each.
  No covers until T09, because the legacy screenshots show outdated sites. A project's `date` is its repository's
  latest commit date (rule in `docs/case-study-template.md`). Experience has 5 roles from the CV and the LinkedIn
  export; the owner confirmed the merged TechyWe entry, the inferred full-time types, the role locations, the EICHE
  figures and the client names. The parent removed a hand-typed "5+ years" from the headline (the dates give about
  6.7 years) and added a guard test.
- 2026-09-28: after writes settled, the owner granted the stop hook's whole-branch review again (172 files, 31,014
  lines). It stopped with `lens_context_budget_exceeded` (terminal, nothing created) and will stop the same way until
  `feat/astro-rebuild` merges into `main`; per-task slices stay the review unit.
- 2026-09-28: correction from the owner: expresión latina and juego con teclado are still on Vercel
  (https://expresion-latina.vercel.app/ and https://game-with-keyboard.vercel.app/), not Cloudflare; T06b linked them.
  T06b also made the integrity checks fail closed: a pure `parseFrontmatterField` helper with its own tests (CRLF,
  quotes, trailing comments, missing block), and every project file must declare `status` and `featured`.
- 2026-09-28: the owner chose the visual direction (see Decisions) after comparing keeping Ubuntu Mono, the system
  monospace, or Ubuntu only. The legacy light theme's body text measured about 2.6:1, so T07 kept the legacy colors
  but changed their roles and re-tuned the light values to pass AA.
- 2026-09-28: T07. Tokens live in `src/styles/tokens.css`; `src/styles/tokens.test.ts` checks every text/background
  pair in both themes with `src/shared/color/contrast.ts` (lowest: dark border 3.6:1 against a 3:1 target). The
  Fonts API is stable since Astro 6 (top-level `fonts`); the files are downloaded at build time and served from the
  site; only Ubuntu 400 is preloaded. The theme is applied by a static inline script before first paint (a stable
  CSP hash for T13) and mirrors `src/shared/theme/resolve-theme.ts` by hand. Gotchas: Astro scopes every class in a
  component `<style>` selector, so the `.no-js` rule lives in `global.css`; Tailwind v4 cascade layers beat
  specificity, so that rule stays unlayered. The nav lists only existing routes (Home) until T09-T11 add pages.
- 2026-09-28: the T06b + T07 slice got one reliability lens and was approved. Its 4 findings, a stale comment and a
  column misalignment seen in the parent's screenshots became T07b.
- 2026-09-28: T07b. While nothing is stored, the inline script follows live OS changes through a `matchMedia` listener
  that re-reads storage on every change and dispatches a `themechange` event, which the toggle uses to update its
  pressed state. The `aria-current` fix is defensive: prerendered routes get a build-time, slash-terminated
  `Astro.url.pathname` (and `astro preview` redirects `/es` to `/es/`), so it matters for on-demand routes (T11).
  Test lessons: a stored theme must be set independently of the OS value, and a non-retrying read right after
  `page.emulateMedia()` can race the `change` event. Header, main and footer now share one container (left edges at
  192 px in a 1280 px viewport), with a 70ch reading measure inside it.
- 2026-09-29: T08 home. The owner chose their public GitHub avatar for the hero (downloaded once to
  `src/assets/profile-photo.jpg`, 460x460 JPEG; served as AVIF/WebP at 192 px). The years line reads "6+ years of
  experience" / "Más de 6 años de experiencia", formatted from `yearsOfExperience`. CTAs: WhatsApp, email, LinkedIn
  and GitHub; the CV button waits for the R2 route and the form button for T11. After the parent's screenshots, the
  owner approved three polish items: full-width project cards (prose keeps the 70ch measure), a headline without the
  repeated role (guarded by the integrity test), and real brand icons. Simple Icons no longer ships LinkedIn, so the
  WhatsApp, LinkedIn and GitHub icons come from Tabler Icons (MIT, notice in `THIRD_PARTY_NOTICES.md`). Equal-date
  featured projects now tie-break by slug. Gotchas: `<Picture>`'s `class` lands on the inner `<img>`, so flex sizing
  goes through `pictureAttributes`; `jsx-a11y` rejects "photo" in alt text, so the alt reads "Portrait of ...".
- 2026-09-29: the owner granted the stop hook's whole-branch review a fifth time (212 files, 34,530 lines); it stopped
  with `lens_context_budget_exceeded` like the others.
- 2026-09-29: T09. The owner chose fresh covers: one-time Playwright captures (1280x800) of the 4 live sites, saved
  as `src/content/projects/<slug>/cover.jpg` and served as AVIF/WebP. The game with keyboard capture shows its
  settings dialog, because the site opens with it; the owner may replace that file. The list shows every published
  project (featured first, then newest); only published projects get pages, so drafts return 404. The nav marks the
  list with `aria-current="page"` and a project page's section with `aria-current="true"`. Project pages show
  "Last updated" (the repository's latest commit date), formatted in UTC: in Lima (UTC-5) a local-time format showed
  the previous day. The Spanish date formatter pins `es-PE` ("setiembre") while experience periods use `es`; T09b
  unifies them. Test gotcha: `<ul class="grid">` loses its implicit `listitem` role in Chromium, so tests select
  `:scope > li`.
- 2026-09-29: the owner granted the stop hook's whole-branch review a sixth time (227 files, 35,372 lines); it stopped
  with `lens_context_budget_exceeded` again.
- 2026-09-29: T09b. `INTL_LOCALE_TAGS` in `src/shared/i18n/locales.ts` (`en-US`, `es-419`) now feeds every date
  formatter; project dates changed from "setiembre" to "septiembre", and experience periods render the same as
  before (`es` and `es-419` share month names). The nav marks the current item with the accent color and a bottom
  border (contrast 9.0-10.3:1 in both themes).
- 2026-09-29: T10. The work was paused mid-verification in the previous session and resumed from the uncommitted
  WIP. The experience page lists every role newest first (company `h2`, role, localized employment type, location,
  period, highlights, stack) with the "N+ years" line; the skills page groups skills by the 6 domain categories. The
  nav now reads Home, Projects, Experience, Skills, and the home experience summary links to the full page. The two
  commits were split without interactive staging by stripping the skills entries from the shared files for the first
  commit. The owner granted the stop hook's whole-branch review a seventh time (239 files, 36,301 lines); it stopped
  with `lens_context_budget_exceeded` like the others.
- 2026-09-29: T10b. The owner kept the years line on the experience page (every page is shared on its own) and the
  Spanish wording (the usual Latin American terms, matching `es-419`; Spain would say "jornada completa"). The date
  oracles became tolerant instead of pinning ICU (Node bundles its own ICU, so pinning means pinning Node). The
  experience gap came from the global `h1` bottom margin (1rem) adding to the flex `gap-8`; the heading and the years
  line now form a `gap-2` group (the hero's text spacing) with `mb-0`. The writer found that the date test's
  `afterEach` stored the string "undefined" in `process.env.TZ` (an unknown zone that behaves as UTC), which hid a
  missing UTC pin from the later tests on a non-UTC host; the parent switched it to `vi.stubEnv`/`vi.unstubAllEnvs`,
  which deletes an unset variable (read in the Vitest 5.0.2 source). Noticed, not changed: the same heading margin
  adds to the gap on other pages (projects list `h1` to grid 48 px, skills `h1` to the first `h2` 48 px, a skills `h2`
  to its list 28 px, a role's company `h2` to its role line 20 px, the hero `h1` to its role line 24 px, a project
  page `h1` to its summary 32 px; no project sets `role` yet). Most of it reads as section rhythm. Owner call.
- 2026-09-29: the owner granted the stop hook's whole-branch review an eighth time (239 files, 36,374 lines); it stopped
  with `lens_context_budget_exceeded` like the others.
- 2026-09-30: T11 owner decisions (research in Engram `discovery/portfolio-t11-contact-options`). EmailJS now, called
  from the Worker, because Cloudflare's own email and Resend's production sending both need a domain; EmailJS sends
  through the owner's Gmail (free: 200 requests a month, 1 per second). Turnstile is required: it has no no-JS path, a
  no-JS fallback would be the path bots take, and bots could spend the EmailJS quota; the acceptance criterion changed
  accordingly. The owner uploads both CV languages.
- 2026-09-30: T11 planning pass (read-only; Astro, Cloudflare and EmailJS docs plus the installed sources). The contact
  pages and `/cv/<locale>.pdf` become the first on-demand routes (the build is assets-only today). No session is needed:
  the action result reaches the page in memory, and a success redirects with 303 to `?sent=1`. Bindings and secrets
  come from `cloudflare:workers` `env` in thin composition roots only, through a config parser that reports names and
  never values; an invalid config shows the same "write me instead" notice as no-JS, so a missing secret never fails a
  deploy. Worker Previews do not inherit vars, bindings or secrets, so a `previews` block mirrors the bucket, the rate
  limiter and the site key; previews show the notice unless the owner adds preview secrets. Tests stay hermetic: a fake
  EmailJS/Turnstile server, the Turnstile test keys and a seeded local R2. Unverified until the first deploys: the rate
  limiting binding on the Free plan (fallback: Turnstile and the honeypot), Turnstile accepting the
  `carlos15erh.workers.dev` hostname, and whether R2 needs a payment method on file. The Spanish 404 relies on Astro
  resolving `/es/404` first (read in the source, not documented); T11e proves it. For T12/T13: the CSP must allow
  `challenges.cloudflare.com`, the 404 pages skip canonical and hreflang, and robots gets `Disallow: /cv/`.
- 2026-09-30: T11a. `/cv/<locale>.pdf` is the site's first on-demand route, so the build now emits a Worker in
  `dist/server` next to the static assets. The pure `serveCv` (a structural bucket type, driven by a fake bucket in
  Vitest) answers 200 as a named attachment with an ETag, `Cache-Control: public, max-age=300, must-revalidate` and
  `X-Robots-Tag: noindex`. A body-less R2 object means a failed precondition: 304 when the request carries
  `If-None-Match` or `If-Modified-Since`, otherwise 412 (the parent's refinement of the plan, per RFC 9110; R2 does not
  say which precondition failed, so a request with both kinds gets 304). An unknown locale, a missing binding or a
  missing object give an uncached, logged 404 with a short text body: Astro 7.3.5 swaps a body-less 404 or 500 for the
  site's error page. The profile `cv` field must equal `cvPath(locale)`, so the home CV button renders in both
  locales. The writer verified the plan's open assumptions: the `previews` block is valid in wrangler 4.141.0,
  `e2e:seed` and the preview share `.wrangler/state`, `wrangler types` needs no login, and i18n routing skips non-page
  routes. Gotcha: `wrangler r2 object put --local` fails with "Network connection lost" when the state path passes
  about 260 characters (Windows). Wrangler only creates a bucket when `bucket_name` is omitted, so the owner creates
  `portfolio-cv` and uploads both PDFs before the branch is pushed (`docs/contact-setup.md`).
- 2026-09-30: the review of the slice from `8c0409c` (T10b + T11a, medium, 1,184 lines) came due, and the stop hook
  offered its whole-branch review a ninth time (248 files, 37,389 lines, high). The owner skipped both for these
  candidates; nothing was created.
- 2026-09-30: the stop hook offered its whole-branch review a tenth time after the T11a record (37,411 lines) and an
  eleventh time after T11b (257 files, 39,105 lines). The owner granted both; both stopped with
  `lens_context_budget_exceeded` like the others, and nothing was created.
- 2026-09-30: T11b. Before the writer started, the parent read Astro 7.3.5's action runtime: with `accept: 'form'` and an
  `input` schema, Astro converts the `FormData` (an empty required text field arrives as `null`, an empty optional one
  as `undefined`) and validates BEFORE the handler, answering invalid input with `ActionInputError`; and any
  non-`ActionError` a handler throws reaches the client with its message. So `contactSchema` issue messages are stable
  codes (`required`, `invalid_email`, `too_long`, `invalid`) for the page's dictionary, and `submitContact` takes the
  parsed input and never throws. It returns `sent` (also the silent answer to a filled honeypot), `rate_limited`,
  `verification_failed` or `delivery_failed`, logs fixed text only, lets a failing rate limiter through (fail open) and
  rejects on a failing verifier (fail closed); a missing token fails after the rate limit without asking Turnstile.
  `parseContactConfig` groups the settings per provider and reports names only. The rate-limit key trusts
  `cf-connecting-ip` only (fallback `unknown`). Readback items routed to T11c: control characters in `name`, a token
  length cap, `http:` seams only on loopback. Kept: Zod's ASCII email pattern (whether EmailJS takes Unicode addresses
  is unverified). For T11d: the handler may throw `ActionError` only, and e2e tests send their own `cf-connecting-ip`.
- 2026-09-30: the stop hook offered its whole-branch review a twelfth time (257 files, 39,124 lines) before the T11c
  writer started. The owner granted it; it stopped with `lens_context_budget_exceeded` like the others, and nothing was
  created.
- 2026-10-04: T11c. `adapters/outbound.ts` holds the shared HTTP policy: one attempt and no retry (EmailJS meters
  requests, Turnstile tokens are single use), `AbortSignal.timeout(8000)`, `redirect: 'manual'` (a followed redirect
  could turn the POST into a GET that answers 200), and an injected `fetch` that defaults to a late-bound
  `globalThis.fetch` (Workers methods lose `this` when stored). No adapter logs: each rejects with a plain `Error` of
  fixed text and at most the HTTP status, with no `cause` and no body read on a non-200, and `submitContact` logs once
  (the composed tests prove one log call per failure). EmailJS counts only HTTP 200 as accepted. Turnstile resolves
  `true` only for a 200 whose JSON says `success: true`; a token past the documented 2,048-character maximum resolves
  `false` without a request; any other status, invalid JSON (V8's parse error quotes the body, so fixed text replaces
  it), a network error or the timeout rejects. The limiter also rejects on a malformed binding answer, so it is logged
  and the request goes through. `createContactDeps(env, fetch?)` reads each `env` entry once into a snapshot (a
  throwing getter counts as not set), reports a missing `CONTACT_RATE_LIMIT` binding as missing and one without
  `limit` as invalid, by name only, and never throws. Every adapter test installs `forbidRealFetch()`, so no test can
  reach a provider. `name` rejects C0 controls and DEL after the trim (a CR or LF in the From Name could start a mail
  header); C1 controls and U+2028/2029 are still accepted. `http:` seams are accepted only for 127.0.0.1, localhost and
  [::1], read from the parsed host. Provider facts come from the docs only (Engram
  `discovery/portfolio-t11c-provider-facts`); still unverified: EmailJS's REST 403/429 answers, Turnstile accepting the
  `workers.dev` hostname, the EmailJS dashboard menu names, and the rate-limiting binding on the Free plan. The
  writer's open questions became T11c-b (a wrong Turnstile secret fails every submission without a log line, and the
  EmailJS status never reaches a log) and a hostname check in T13 (previews run on other hostnames). Tooling gotchas:
  ESLint 10's `preserve-caught-error`, `no-control-regex` (the schema uses a char-code loop), and `astro check`
  catching type errors that Vitest misses.
- 2026-10-04: after the T11c record, the stop hook offered its whole-branch review a thirteenth time (267 files, 42,106
  lines, high: process spawning and shell in `.github/workflows/ci.yml`). The owner granted it; it stopped with
  `lens_context_budget_exceeded` like the others, and nothing was created.
- 2026-10-04: the stop hook offered its whole-branch review a fourteenth time after `fc03da1` (267 files, 42,112
  lines), before the T11c-b writer started; granted; it stopped with `lens_context_budget_exceeded`. A fifteenth time
  (269 files, 43,268 lines) came while the writer's follow-up was running; granted, but START refused it with
  `stale_target_identity`, because the writer's last commit landed while the question was open. Nothing was created
  either time.
- 2026-10-04: T11c-b. `src/modules/contact/provider-failure.ts` holds `ProviderFailure` (fixed text plus at most one
  detail: an integer HTTP status from 100 to 599, or one of `TURNSTILE_FAULT_CODES`; the first valid one wins, and
  never a `cause`) and `failureSuffix`, which reads only a real instance and checks again what it prints.
  `submitContact` appends that suffix to its verifier and sender lines (`(HTTP 403)`, `(invalid-input-secret)`);
  without a detail the lines are unchanged, and the visitor's outcomes did not change. For a 200 that is not a
  success, the verifier rejects with the highest-priority fault code (secret, then request, then Turnstile); a string
  code outside Cloudflare's table rejects without detail (the parent's follow-up after the readback: a code the
  Worker does not know proves nothing about the token, and Turnstile's text is never printed); only the 3 token codes,
  or no codes, resolve `false`. The parent re-checked Cloudflare's Siteverify table (the rendered page and the raw
  source): exactly 7 codes; `invalid-widget-id` and `invalid-parsed-secret`, which the writer recalled, are not in
  it. `docs/contact-setup.md` lists every log line and what it means; EmailJS's 403 and 429 stay marked as
  undocumented. Open for T11d (owner question): what the visitor sees when the verifier cannot answer.
- 2026-10-04: owner decision for T11d: a verifier that cannot answer shows the "form unavailable" notice (email and
  WhatsApp), because the fault is on the server's side and retrying cannot help the visitor.
- 2026-10-04: the stop hook offered its whole-branch review a sixteenth time after `3780201` (269 files, 43,524 lines);
  granted; it stopped with `lens_context_budget_exceeded`, and nothing was created.
- 2026-10-04: the owner looked at the site on the local dev server ("pretty good") and asked for two changes: links
  open in a new tab (T10c, now) and the dark theme's cyan adjusted (T10d, later). The parent scoped T10c to external
  links. Gotchas: the e2e web server reuses whatever already listens on port 4321, so a running `astro dev` must be
  stopped before e2e runs; and with `astro dev --background` piped into another command the server was gone once that
  command ended, while with its output sent to a file it kept running.
- 2026-10-04: the stop hook offered its whole-branch review a seventeenth time after `5390eaa` (269 files, 43,542
  lines), but the parent relayed it after the T10c writer had started. The owner granted it, and START refused it with
  `invalid_request` ("untracked files require an explicit declaration": the writer's new files), so nothing was
  created. Lesson kept: answer the whole-branch prompt before launching a writer.
- 2026-10-04: T10c. `src/shared/links/is-external-href.ts` says whether an `href` leads to another site (an absolute
  `http:` or `https:` URL, read with the browser's URL parser), and `src/components/Link.astro` renders every anchor
  whose `href` can be external: for those it adds `target="_blank"`, `rel="noopener"` (not `noreferrer`: browsers send
  only the origin, and the owner's own sites may want to see visits from the portfolio) and a visually hidden hint
  after a plain space, so the accessible name reads "GitHub (opens in a new tab)" / "GitHub (se abre en una pestaña
  nueva)". The e2e spec checks every anchor on 10 pages (both locales), with a floor of external links per page, so a
  future external link cannot slip through. 40 full-page screenshots were byte-identical to the base build, so the
  change is invisible. Known limits: an absolute URL to the site's own origin counts as external, and a
  protocol-relative `//host` counts as internal (neither exists today); links written inside a project's markdown body
  would render as plain anchors (none exist today; when a case study adds one, add a rehype plugin or a components
  override for it).
- 2026-10-04: the stop hook offered its whole-branch review an eighteenth time at the end of the session (after
  `741f4c3`); granted; nothing was created.
- 2026-10-05: T11d, from the parent design (Engram #439). `submitContact` answers `unavailable` when the verifier
  rejects or throws (an outage, a timeout, a wrong secret, a fault or an unknown code), because it never judged the
  token; a missing or blank token, or any answer but `true`, stays `verification_failed`; nothing is sent either way and
  the one log line is unchanged. One pure `contactPageState` turns the Action's answer and the Worker's config into the
  page state and status: the form (200); field errors (400, the values kept, an error summary, an "Error:" line per
  field, `aria-invalid` and `aria-describedby`, the title prefixed); a try-again alert with email and WhatsApp (400); a
  429 with `Retry-After: 60`; a 413 (the body is never read, so nothing is kept); the fallback notice in place of the
  form, with the visitor's message in a labelled read-only text area to copy (502 when delivery fails, 503 when the
  verifier cannot answer, 200 when the Worker lacks a setting, which `handleContact` logs by name only); and for
  `sent`, the honeypot's silent answer included, a 303 to the page's own localized `?sent=1`, built from the locale
  alone (no open redirect). The pages are thin roots that read `env` from `cloudflare:workers`; the components render a
  view model and are tested by container render in both locales, and visitor text is written only through Astro's
  escaping. The honeypot field `website` is off screen, `aria-hidden`, out of the tab order and out of autofill.
  Without JavaScript, unlayered rules in `global.css` hide the form and show a notice with email and WhatsApp (a test
  keeps them out of every `@layer`). `TURNSTILE_SITE_KEY` stays out of `wrangler.jsonc` until the owner creates the
  widget (a dummy key would fail every submission with an unlogged token error); a missing key shows the notice.
  `CONTACT_RATE_LIMIT` allows 3 posts per 60 s from one address, in namespace `7301` (`7302` for previews; owner
  question Q5: are both unused in the account?). `/_actions/contact` answers every outcome as HTTP 200 with the outcome
  as data; the statuses above are the contact pages'. The e2e harness is hermetic: its own build (`CLOUDFLARE_ENV=e2e`
  reads `.dev.vars.e2e`: Cloudflare's Turnstile test keys, fake `e2e-` EmailJS values, loopback seams) on port 4331,
  never reusing a server; fake EmailJS and Turnstile servers on 4332 that record every call; a guard in global setup
  that checks the files the server reads (names only, never values) and, once the server is up, that the contact page
  carries the e2e site key, or the run stops before the first test. CI's Build step sets the same variable. The axe and
  layout checks (every state, both locales and themes; 320, 390, 768 and 1280 px) found that the header nav no longer
  fit once Contact joined it (wider than the screen at 320 px in English and 390 px in Spanish); it wraps now. Owner
  question Q7: the Spanish contact copy. Writer notes: Engram #440 (platform facts from a spike), #447 (test and
  tooling gotchas), #448 (implementation decisions).
- 2026-10-05: T11d follow-up (parent): the Action body limit went from 32 KiB to 64 KiB (`1acfe20`). A browser sends
  the form urlencoded, which writes each byte of a non-ASCII character as three, so the largest valid submission is
  52,869 bytes, and a full-length message in a two-byte script (Cyrillic, Greek, Arabic, Hebrew) already got a 413.
  `ACTION_BODY_LIMIT_BYTES` lives in `src/modules/contact/form-body-limit.ts` next to `largestFormBodyBytes`, which
  computes that body from the schema's own limits; a unit test keeps the limit between it and twice it. Three full e2e
  runs (383 tests, 14 workers) took 16.8 to 24.4 s, far under the 10-minute rule for a second CI worker, so CI keeps
  one. The earlier 7.8- and 10.0-minute runs were not representative: the machine was under unrelated CPU load.
  Engram #451.
- 2026-10-05: the stop hook offered its whole-branch review a nineteenth time during the T11d follow-up; the owner
  granted it, but START refused it with `stale_target_identity` because the writer's commit landed while the question
  was open; nothing was created.
- 2026-10-08: T11d review and merge, after the owner's "Let's complete T11d". A review's candidate always runs from a
  base to HEAD, so slices A and B ran from temporary detached worktrees at their last commits (`00d272b`, `d43c37e`;
  removed afterwards) and slice C from the branch tip. The owner granted each one; each was approved with 0 blocking
  findings and acknowledged (see the T11d row). Merged `--no-ff` as `4745fc1`, whose tree equals the reviewed and
  tested tree `c10d368`. The six findings still true at the tip became T11d-b. Nothing was pushed: the owner rotates
  the credentials first (planned for the weekend of 2026-10-10).
- 2026-10-09: the stop hook offered its whole-branch review a twentieth time after `5d56525` (315 files, 51,312 lines,
  high); granted; START stopped with `lens_context_budget_exceeded`; nothing was created. It is recorded here rather
  than in a commit of its own, because a new commit is a new candidate and would only fire the hook again.
- 2026-10-09: T11e, from the parent design (Engram topic `odd/portfolio-astro-rebuild/t11e-design`). In Astro 7.3.5,
  `getErrorRoutePath` picks `/<locale>/404` for an address whose first segment is a locale with that page, else
  `/404`; the Worker fetches the prerendered page from the static assets and answers 404. The e2e spec proves it on the
  preview server: every miss under `/es/` gets the Spanish page, every other one (`/escape/`, `/en/x`, `/ES/x`, `/x.pdf`
  and `/_astro/nope.js` included) the English one, and `/cv/unknown.pdf` keeps its plain-text 404. `BaseLayout` and
  `LanguageSwitcher` take an `errorPage` flag: no hreflang alternates, the switcher links to each locale's home, and no
  nav item is current. The last part matters only where the page renders on demand for the visitor's address (`astro
  dev` marked "Projects" on `/projects/x`); the prerendered page is built for `/404`. The pages are
  `dist/client/404.html` and `dist/client/es/404/index.html`; `/404` and `/es/404/` answer 200 as plain assets (`/404/`
  and `/es/404` a 307), so T12 adds `noindex` there. A container test of `BaseLayout` needs `astro:content` mocked,
  because a fresh clone has no synced `.astro` store. The Spanish copy ("Página no encontrada", "La página que buscas no
  existe o fue movida.", "Ir al inicio", "Ver los proyectos") joins Q7. Writer note: Engram #483.
- 2026-10-09: T11e review and merge, after the owner's "let's do T11e meanwhile". The slice from `1acfe20` (the T11d
  record and T11e) was granted by the owner, approved with one advisory suggestion (now T11d-b item 7) and
  acknowledged; merged `--no-ff` as `9c35533`, whose tree equals the reviewed and tested tree `26ecc4a`. Meanwhile the
  owner creates the R2 bucket in the dashboard: Standard storage class, the Public Development URL and custom domains
  left off, objects named `en.pdf` and `es.pdf` (`docs/contact-setup.md` describes the CLI path).
- 2026-10-09: the stop hook offered its whole-branch review a twenty-first time after `1d41d29` (321 files, 51,857
  lines, high); granted. The START's output was lost to a broken pipe in the parent's shell; a lineage-bound read-only
  STATUS showed no authority created and the target still fresh, so nothing was created. Lesson kept: one-shot review
  commands write their output to a file first.
- 2026-10-09: T11d-b (writer note: Engram #487). The external-links spec excuses only invisible links inside
  `#contact-nojs`. `retryOnProxyFailure` keeps its policy but records every retry as a `proxy-retry` annotation and a
  console warning; the cause is the HTTP status or a matched keyword, never the error message, which carries a whole
  call log. The rate-limit window wait runs only for the rate-limited axe state (4 of 32 tests). The global teardown
  fails the run naming each unexpected `METHOD /path` (never a body or query) and still closes the fakes in a
  `finally`; Playwright then exits 1 with "1 error was not a part of any test" while the tests count as passed. The
  verification verdict `rejected` is now `refused`; the adapter comments keep "rejected token" in the visitor-token
  sense, and the log line is unchanged by design. `src/components/home/ContactCtaButton.astro` is the one place for the
  CTA label map and button classes. The reset keyword was seen only on Windows (`socket hang up`); the first Linux CI
  run will show whether `ECONNRESET` matches there. `docs/contact-setup.md` mentions the teardown failure.
- 2026-10-09: T11d-b review and merge, after the owner's "yes. Go ahead". The slice from `f31d941` (the T11e record and
  T11d-b) was granted, approved with one advisory suggestion (a harness test for the teardown wiring, now in T13) and
  acknowledged; merged `--no-ff` as `5f29f95`, whose tree equals the reviewed and tested tree `8dbc3bd`. T11 is
  complete. The owner created the R2 bucket `portfolio-cv` with `en.pdf` and `es.pdf`, so the credential rotation is
  the last gate before the branch push.
- 2026-10-09: the stop hook offered its whole-branch review a twenty-second time after `422625a` (323 files, 52,195
  lines, high); granted; START stopped with `lens_context_budget_exceeded`; nothing was created.
- 2026-10-11: the owner pushed `feat/astro-rebuild` (132 commits on top of `52fe1a3`). Before the push the parent
  checked the outgoing commits locally: no AI attribution and no secrets (the committed `.dev.vars.e2e` and
  `.dev.vars.example` hold only Cloudflare's published Turnstile test keys and fake or blank values; the CV fixtures are
  597-byte PDFs). GitHub CI passed on ubuntu in 3 minutes (lint, format, check, unit, build, e2e), and Workers Builds
  built the branch as a Worker Preview (dashboard: the Worker's Previews section, and Deployments > View build
  history; Version History and Active Deployment show production only). On the preview, `/cv/en.pdf` and `/cv/es.pdf`
  answer 200 as named attachments with `X-Robots-Tag: noindex`, `/no-such-page` and `/es/no-such-page` answer 404
  with the English and Spanish pages, and both contact pages show the "form unavailable" notice (no Turnstile key or
  secrets yet). The upload with the rate-limit binding went through. Every preview response carries `X-Robots-Tag:
  noindex`, which Cloudflare adds to Worker Preview URLs. The Vercel project also built the branch.
- 2026-10-11: the stop hook offered its whole-branch review a twenty-third time (the same candidate as the 22nd);
  granted; START stopped with `lens_context_budget_exceeded`; nothing was created.
- 2026-10-11: T12 planning pass (read-only; the Astro, Cloudflare, Google Search Central, Open Graph and LinkedIn docs,
  plus the installed sources). Today's head has the title, the description and the hreflang alternates only, and there
  is no `public/`. `@astrojs/sitemap` 3.7.4 (no peer range, old enough for pnpm's release-age rule) uses hooks that
  exist in Astro 7.3.5, lists static on-demand pages (contact) and drops the 404 pages when its `i18n` option is set;
  T12b's e2e proves it at runtime. Google ignores a `noindex` it is not allowed to crawl, so robots.txt does not block
  `/cv/` (this drops the T11 planning note). The canonical comes from `site`, never from the request's origin. Social
  images: project covers cropped at build time with `getImage`, and a static default card per locale; generated cards
  (satori and similar) would need Node prerendering (`prerenderEnvironment: 'node'`) for the whole site, so they are
  deferred. Google's `ProfilePage` markup is not used: its recommended dates cannot be sourced without inventing them.
  A JSON-LD block needs no CSP hash in T13, because a data block never runs. Six e2e specs assert exactly three
  `link[rel="alternate"]`, so T12 adds no other alternate link (no `alternate icon`).
- 2026-10-11: the stop hook offered its whole-branch review a twenty-fourth time after `889497d` (323 files, 52,250
  lines); granted; START stopped with `lens_context_budget_exceeded`; nothing was created. A twenty-fifth time after
  `5931e31` (326 files, 52,732 lines); granted, but START refused it with `invalid_request` ("untracked files require
  an explicit declaration": the writer's follow-up had new files in the tree while the question was open); nothing was
  created.
- 2026-10-11: T12a. `src/shared/site/site-url.ts` holds `SITE_URL`, the one place that names the host, and
  `astro.config.mjs` and the tests import it. The writer first put it in `src/shared/i18n/locales.ts`, following the
  parent's brief; the parent had it moved, because the site's origin is not an i18n concept. `canonicalHref(pathname,
  site)` in `src/shared/i18n/paths.ts` keeps the pathname up to the first `?` or `#`, normalizes the trailing slash
  through `pathnameInLocale` and prefixes the origin of `site`, so it equals the page's own hreflang alternate.
  `BaseLayout` renders it on every indexable page from `Astro.site`, never from the request's origin (a container test
  renders from a preview and a localhost origin), and gives an error page `<meta name="robots" content="noindex">` and
  no canonical. The home title and description come from `homeMetadata`
  (`src/modules/profile/domain/home-metadata.ts`): "Carlos Rodríguez Huerta — <role>" and "<role>. <headline>", or the
  role alone when the profile has no headline. `siteDescription` and `rebuildNotice` left both dictionaries (the home
  pages were their only readers); `siteTitle` stays for the header and the other titles. `e2e/seo.spec.ts` compares
  its table of 18 indexable pages with the `index.html` files of the build, so a page cannot drop out unchecked. The
  README's "rebuild in progress" refers to the repo and stays until T14. Q7 now also covers the Spanish home title and
  description. Writer note: Engram #501.
- 2026-10-11: T12a review and merge, after the owner's "Sí. Arranquemos T12". The slice from `889497d` was granted,
  approved with 0 findings (`review-44d421d6be6f71f9`) and acknowledged; merged `--no-ff` as `bcf61fe`, whose tree
  equals the reviewed and tested tree `d38821c`.
- 2026-10-11: the stop hook offered its whole-branch review a twenty-sixth time after `d2a7f69` (328 files, 52,750
  lines); granted; START stopped with `lens_context_budget_exceeded`; nothing was created.
- 2026-10-11: T12b. `src/pages/robots.txt.ts` is a prerendered endpoint over the pure `buildRobotsTxt(site)`
  (`src/shared/seo/robots-txt.ts`): `User-agent: *`, `Allow: /` and the sitemap index by its absolute URL; nothing is
  disallowed. `@astrojs/sitemap` 3.7.4 (it brings `sitemap` 9.0.1, `arg` 5.0.2 and `@types/sax` 1.2.7; pnpm raised no
  release-age objection) writes `sitemap-index.xml` and `sitemap-0.xml` into `dist/client`. Its `i18n` option is built
  from `LOCALES`; without it `/es/404/` would be listed. It lists the 18 indexable pages, the on-demand contact pages
  included, and no endpoint (`/cv/`). Its `serialize` adds the `x-default` alternate taken from `hreflangAlternates`
  (`withXDefaultAlternate`, `src/shared/seo/sitemap-alternates.ts`), so the sitemap says what each page head says; the
  e2e compares the two as sets, because the integration's order is not locale order. `lastmod`, `changefreq` and
  `priority` stay unset. The sitemap exists only in builds (`astro dev` answers 404 for it). The version range follows
  the repo's caret convention (`^3.7.4`; the lockfile resolves 3.7.4). Writer note: Engram #504.
- 2026-10-11: T12b review and merge, after the owner's "Sí, seguí con T12b". The slice from `d2a7f69` was granted,
  approved with 2 advisory suggestions (`review-2d95904680bbb411`: the throw in `withXDefaultAlternate` has no unit
  test; the e2e pins the exact robots.txt `Content-Type`, which the static-asset server sets) and acknowledged; both
  go to T12c. Merged `--no-ff` as `0dc0da1`, whose tree equals the reviewed and tested tree `5b99be5`.
- 2026-10-11 and 2026-10-12: the stop hook offered its whole-branch review a twenty-seventh time after `7d1d442` (333
  files, 53,378 lines), a twenty-eighth after `ad97769` (337 files, 54,208 lines) and a twenty-ninth after `cddfe93`
  (339 files, 54,261 lines); all granted; each START stopped with `lens_context_budget_exceeded`; nothing was created.
- 2026-10-12: T12c. `src/shared/seo/social-meta.ts` builds the tags as plain data: `og:type` `website`,
  `og:site_name`, `og:title`, `og:description`, `og:url` (the canonical), `og:locale` from `OPEN_GRAPH_LOCALES`
  (`en_US`, `es_LA`; keyed by `Locale`, so a new locale fails the typecheck) with the other locale as
  `og:locale:alternate`, the picture with its size and alt when there is one, and `twitter:card` (`summary_large_image`
  with a picture, `summary` without). `BaseLayout` renders them on indexable pages only and resolves the picture
  against `Astro.site`. Project pages crop their cover with `getImage` (`SOCIAL_IMAGE_TRANSFORM` in
  `src/shared/seo/social-image.ts`: 1200x630, `fit: 'cover'`, `position: 'top'`, JPEG; the files come out as `.jpeg`).
  The image service never enlarges, so a cover must be at least 1200x630 (`docs/case-study-template.md` says so).
  Pages without a cover get no picture until T12d. `coverAltText(title, locale)`
  (`src/modules/projects/domain/cover-alt-text.ts`) is the one rule for a cover's alt text (card, detail page and
  social image); the parent asked for it after four copies appeared. Unverified: whether X reads `og:image:alt` or
  needs `twitter:image:alt`. Writer note: Engram #508.
- 2026-10-12: e2e flake diagnosis (read-only, two temporary worktrees, 37 instrumented runs; Engram #513). The writer
  saw 3 of 10 full e2e runs fail on the T12c tip, two of them with dozens of failures. The flake predates T12c:
  back-to-back full runs on this Windows machine exhaust the loopback ephemeral ports (each run leaves about 3,700
  sockets in TIME_WAIT for 120 s, against 15,524 usable ports; Tcpip event 4227 comes just before each burst), and the
  preview server listens on `::1` only, so after `EADDRINUSE ::1:4331` the IPv4 fallback is refused and the browser
  reports `ERR_CONNECTION_REFUSED` while the server is still up. T12c's 32 extra tests add about 8% more sockets, so a
  loop reaches the ceiling one run sooner (failing runs: base 3 of 17, T12c 8 of 17; not significant, Fisher p 0.14).
  The documented `contact-body-limit` proxy race still exhausts its retries now and then on both trees. The server
  never crashed (workerd peaked at 351 MB). Routed to T13.
- 2026-10-12: T12c review and merge, after the owner's "Sí, seguí con T12c". The slice from `7d1d442` was granted,
  approved with 1 advisory warning and 2 suggestions (`review-a1fdb60f738d38de`: the cover's e2e locator `main img`
  would break on a case-study image; the declared `og:image` size comes from constants, not from what `getImage`
  produced; a test relies on `mockReturnValueOnce` running last) and acknowledged; all three go to T12e. Merged
  `--no-ff` as `a6c6f67`, whose tree equals the reviewed and tested tree `74caa55`.
- 2026-10-12: Q5 answered (Engram, topic `odd/portfolio-astro-rebuild/q5`). Cloudflare's docs say rate limiting
  bindings are not visible in the dashboard, so the check was indirect. The account's Pages projects cannot hold a
  rate limiting binding (the Pages Functions bindings list has none). `bachatealo` has none in any of its 20 local
  refs. The code of `wa-orders-worker` and `landing-publish` is not on this machine. A clash would only share
  counters and never fails a deploy, so `7301` and `7302` stay. Optional check: search for `.limit(` in those two
  Workers' code in the dashboard.
- 2026-10-12: T12e (writer note: Engram #520).
  - `src/shared/seo/json-ld.ts`: `buildPersonJsonLd` throws if `url`, `image` or a `sameAs` entry is not absolute.
    `serializeJsonLd` escapes every `<`.
  - `BaseLayout` takes an optional `jsonLd` prop, rendered as an inline `application/ld+json` script.
  - Both home pages build it from the profile only. `url` is `canonicalHref` of the page; `image` is the photo
    through `getImage` as JPEG, made absolute with `Astro.site`. A profile without `photo` or `headline` fails the
    build instead of getting a fallback.
  - The e2e checks the literal values on both homes, that the photo is served as `image/jpeg`, and that the served
    script has no raw `<`. It also checks 19 other pages, the 404s included, for no JSON-LD.
  - Item (2) of the T12c review: a content-schema minimum cannot work. At schema time the glob loader gives `image()`
    a placeholder string, so there is no size to check. Reading `getImage`'s options would echo the requested size.
    So `assertCoverFitsSocialImage` (`src/shared/seo/social-image.ts`) reads the cover's real metadata in both
    project pages and throws with the project and both sizes. The first attempt (`b284de1`) was reverted with
    `ad51935`, not squashed, because the writer's `git reset --hard` was denied.
  - Gotcha: `node_modules/.astro/data-store.json` caches parsed content, so a schema change does not re-run until it
    is deleted.
- 2026-10-12: the stop hook fired three times while the T12e writer ran (firings 30 to 32).
  - 30: the writer's uncommitted workspace (4 files, 61 lines: the schema refine later reverted). Granted; approved
    with 0 findings (`review-6fa52899f93c274e`) and acknowledged.
  - 31: a later uncommitted workspace (4 files, 12 lines). Granted. `review-9947d9521ea01278` returned
    `correction_required`, with 2 blockers and 2 warnings, all about transient debugging state: a temporary probe
    image in the project page, a refine with unbound names and a debug log, and the selector exclusion not yet
    proven. The parent relayed them to the writer. The writer confirmed none reached a commit, and they do not
    appear in `233881c`. The workspace had moved on, so the lineage became unrelated and was left open, unacknowledged.
  - 32: the whole branch from `v1-legacy` (`d583e09`; 341 files, 54,705 lines, high). Granted;
    `lens_context_budget_exceeded`; nothing created.
- 2026-10-12: T12e review and merge. The assessment of `811438d..233881c` was medium and due (`slice_budget_reached`,
  438 lines). Granted; approved with 1 advisory warning (`review-7e1cdf503b57bd14`, no action: Vitest 5.0.2) and
  acknowledged. Merged `--no-ff` as `fa695de`, whose tree equals the reviewed and tested tree `0f3ef44`.
- 2026-10-12: T12d and T12f drafts, prepared outside the repo for the owner's approval (session scratchpad
  `drafts/`; sources `og-card.html`, `common.css`, `icon.svg`, `render.mjs`, `build-ico.mjs`, rendered with the
  project's Playwright and the cached Ubuntu fonts).
  - The card: dark `#161a17`, a `>_` mark, the name in Ubuntu Bold, the role in Ubuntu Mono cyan, one per locale. The
    lowest contrast is 10.27:1.
  - The icon: a `>_` mark drawn as paths. The parent flagged that the light variant (white on blue) looks like the
    PowerShell icon, and recommended the dark variant (cyan on `#161a17`) for every icon.
  - Proposed `theme-color`: `#faf9f5` light and `#161a17` dark.

## Next step

T12d and T12f, once the owner approves the drafts of the social card and the icon (the parent recommends the dark
icon variant everywhere; see the change log). Then T13 (hardening) and T14 (launch). T10d when the owner gives the
color direction. Before a writer runs e2e, stop any `astro dev` on port 4321. Answer the stop hook's prompt before
launching a writer; a running writer's workspace keeps producing new review candidates. Owner: Q7 (the Spanish copy
of the contact and 404 pages, plus the home title and description from T12a). Before live checks of the form: create the Turnstile widget (confirm it accepts the
`carlos15erh.workers.dev` hostname), set up EmailJS (service, template, non-browser API, keys; see
`docs/contact-setup.md`) and add the Worker secrets. Still unknown: whether `ECONNRESET` matches the e2e retry keyword
on Linux (the first Linux CI run passed; its log was not read). Optional: the heading-spacing rhythm noted in T10b.
