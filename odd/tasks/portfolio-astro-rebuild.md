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
- Running count: ~8,875 authored lines (T01 ~270 + T02 ~215 + T03 ~125 + T03b ~35 + T04 ~1,197 + T04b ~268 +
  T05 ~511 + T05b ~47 + T06 ~715 + T06b ~106 + T07 ~1,092 + T07b ~321 + T08 ~1,021 + T09 ~923 + T09b ~217 +
  T10 ~778 + T10b ~88 + T11a ~935, with tests, excluding lockfiles and the legacy removal). It already passes the
  ~4,300 forecast, mostly from tests and the review follow-up tasks.
- Last reviewed boundary: `8c0409c` (T09b + T10 slice; the merge `b4a32a2` has the same tree). The next slice (the
  T10 docs `1edaac9`, T10b, the T10b docs `9b0bcc4`, the T11 plan `e201a3c` and T11a up to `9ac381e`; medium, 1,184
  lines) came due and the owner skipped its review (2026-09-30). As with the legacy removal, the next slice starts
  after the skipped range: base `9ac381e` (the merge `6c345c9` has the same tree).

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
- [ ] **T11** Contact: form via Astro Action (Zod validation), `EmailSender` port + EmailJS adapter, Turnstile + honeypot +
  rate limit, WhatsApp + mailto, CV download (R2), 404 page. Planned on 2026-09-30 by a read-only planning pass (see the
  change log) as five sub-tasks, each on its own branch `feat/astro-rebuild-11<x>-<slug>`. ~2,500-3,000 with tests and
  the e2e harness (the first estimate was ~450).
  - [x] **T11a** CV download via R2, the first on-demand route: `/cv/<locale>.pdf` streams `en.pdf`/`es.pdf` from the
    `CV_BUCKET` binding (bucket `portfolio-cv`); 404 for an unknown locale, a missing binding or a missing object; 304 on
    `If-None-Match`; an `attachment` with a named file, `noindex`. The profile `cv` field is set per locale, so the home
    CV button renders. Local R2 seeded with fixture PDFs for e2e; `wrangler types` runs before `astro check`; `.dev.vars`
    ignored. Route: delegated. Owner, before the first push: create the bucket and upload both PDFs.
  - [ ] **T11b** Contact core, pure: the form schema (name, email, message, honeypot, Turnstile token, locale; stable
    error codes), the `EmailSender` port, a config parser that reports names and never values, and `submitContact`
    (schema, then honeypot with a silent success, rate limit, Turnstile, send); the rate-limit key comes from
    `cf-connecting-ip` only. Route: delegated.
  - [ ] **T11c** Adapters tested with a mocked `fetch`: EmailJS sender, Turnstile verifier, Workers rate limiter (fails
    open on binding errors), dependency wiring; 8 s timeouts; no secret in any error text. Route: delegated.
  - [ ] **T11d** Contact page, Action and form (EN/ES), in four commits: the hermetic e2e harness (fake EmailJS and
    Turnstile server, `.dev.vars.e2e`, `CLOUDFLARE_ENV=e2e`) with the page shell, nav item and home form CTA; the action
    and form (303 to `?sent=1` on success, localized field errors with the values kept); the Turnstile widget and the
    honeypot; the no-JS and "form unavailable" notices, axe. Route: delegated. Owner, before live checks: EmailJS
    (service, template, non-browser API, keys), the Turnstile widget and keys, Worker secrets.
  - [ ] **T11e** 404 pages in EN and ES (`src/pages/404.astro`, `src/pages/es/404.astro`). Route: delegated.

### Phase 3 · Launch

- [ ] **T12** SEO: meta, Open Graph/Twitter, OG images, JSON-LD Person, sitemap + robots, canonical, favicons/manifest. Route: delegated. ~300.
- [ ] **T13** Hardening: axe on every page, Lighthouse CI budgets, link check, security headers. Route: delegated. ~200.
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

## Next step

T11b (contact core, pure). Owner, in parallel: create the R2 bucket `portfolio-cv` and upload `en.pdf` and `es.pdf`
before `feat/astro-rebuild` is pushed (T11a is merged, and Workers Builds deploys every pushed branch); create the
Turnstile widget early to confirm it accepts the `carlos15erh.workers.dev` hostname; set up EmailJS before T11d.
Optional: the heading-spacing rhythm noted in T10b.
