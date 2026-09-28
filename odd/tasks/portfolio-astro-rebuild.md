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
| Rendering | Static by default; on-demand only for the contact form action (and Phase 4 hooks) |
| Hosting | Cloudflare Workers: static assets + `@astrojs/cloudflare` for server routes; `*.workers.dev` until a domain exists. Vercel is the fallback |
| Content | Content Layer collections with Zod schemas: schema = port, loader = adapter |
| Seams | Only where the source will change: `projects` (local, then GitHub) and contact email delivery (provider adapter) |
| i18n | `en` default at `/`, `es` at `/es/`, hreflang in the sitemap |
| Contact | Form (Astro Action -> `EmailSender` port -> provider adapter) + WhatsApp link + mailto |
| Styling | Tailwind v4 via `@tailwindcss/vite`, Astro Fonts API, `<Picture>` with AVIF/WebP |
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
- Running count: ~1,840 authored lines (T01 ~270 + T02 ~215 + T03 ~125 + T03b ~35 + T04 ~1,197 with tests,
  excluding lockfiles and the legacy removal).
- Last reviewed boundary: `00a7109` (T03b + T04 slice; the merge `9a8befc` has the same tree).

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
- [ ] **T04b** Follow-ups from the T03b + T04 review: reject experience entries whose `end` precedes `start`, and
  keep `yearsOfExperience` from subtracting months for inverted or future-dated ranges (warning); parse project ids
  at the last slash and fail loudly on nested ids or unsupported locale segments; give the `formatPeriod` tests a
  literal oracle; pin the clock (`vi.setSystemTime`) in the default-`now` test. Route: delegated. ~80.
- [ ] **T05** i18n: routing config, typed UI dictionary, language switcher, hreflang helpers. Route: delegated. ~250.
- [ ] **T06** Content: profile + experience from the CV/LinkedIn PDFs (EN/ES), skills, the 6 legacy projects with basic data, documented case-study template. Route: delegated. ~450.

### Phase 2 · UI

- [ ] **T07** Design tokens, dark/light theme (no flash, persisted, OS default), fonts, base layout (header, nav, footer, skip link, landmarks). Route: delegated. ~400.
- [ ] **T08** Home: hero, CTAs (form, WhatsApp, email, LinkedIn, GitHub, CV), featured projects, experience summary. Route: delegated. ~300.
- [ ] **T09** Projects list + `/projects/[slug]` case-study pages with optimized images. Route: delegated. ~350.
- [ ] **T10** Experience timeline + skills page. Route: delegated. ~250.
- [ ] **T11** Contact: form via Astro Action (Zod validation, works without JS), `EmailSender` port + provider adapter, Turnstile + honeypot + rate limit, WhatsApp + mailto, CV download, 404 page. Route: delegated. ~450.

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
- The contact form reaches the owner's inbox, validates on the server, works without JS and rejects bots.
- CI green on every PR: lint, typecheck, unit, e2e, build.
- Repo identity belongs to the owner: README, LICENSE, package metadata.

## Checks per task

`pnpm lint` · `pnpm astro check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`
(available from T02; T01 runs `pnpm astro check` + `pnpm build`).

## Progress

| Task | Status | Commit | Checks | Review |
|---|---|---|---|---|
| T01 | done (merged `fd7a95e`) | `3b9a198` removal, `4788004` scaffold, `f811b2a` license | `pnpm check`: 0 errors/warnings/hints · `pnpm build`: 1 page | Removal: accepted unreviewed by owner (too large for review). Scaffold: medium, reviewed, approved (`review-66453b14bc688b02`), 3 non-blocking suggestions |
| T02 | done (merged `a8b7f06`) | `024bfa1` lint/format, `8d1783f` tests, `b404c79` CI, `5d51829` CI token | `pnpm lint` pass · `pnpm format:check` pass · `pnpm check` 0/0/0 · `pnpm test` pass (no tests yet) · `pnpm build` 1 page · `pnpm test:e2e` 2/2 (parent re-ran: 2/2) | High (CI shell), 4 lenses, approved (`review-51c99e8eda1bea15`), 8 non-blocking findings routed to T03/T04 |
| T03 | done (merged `164019f`, pushed `52fe1a3`; GitHub CI green, Workers Builds preview green) | `fde0993` adapter + `wrangler.jsonc`, `717ea51` CI SHA pins + e2e reuse, `1bbd29d` bindings off | `pnpm lint` pass · `pnpm format:check` pass · `pnpm check` 0/0/0 · `pnpm test` pass · `pnpm build` 1 page · `pnpm test:e2e` 2/2 (parent re-ran: 2/2) · `wrangler deploy --dry-run`: no bindings | High (CI shell), 4 lenses, approved (`review-02fe771a972ded47`), 9 non-blocking findings routed to T03b |
| T03b | done (merged `f24f152`) | `d2f5faa` compat date + release-age bypass removed, `2d8ed60` CI e2e fail-fast, tsconfig, README | `pnpm install --frozen-lockfile` pass · lint · format · `pnpm check` 0/0/0 · `pnpm test` pass · build · `pnpm test:e2e` 2/2 · dry run: no bindings, no compat warning · CI fail-fast shown · parent re-ran install/build/dry run: pass | Reviewed with T04 (see T04) |
| T04 | done (merged `9a8befc`) | `5ccdb82` collections + schemas, `35e9b69` experience rules, `ab6e082` project rules, `00a7109` skill grouping | Strict TDD: RED (module not found) before GREEN per behavior · `pnpm test` 69/69 in 13 files · lint · format · `pnpm check` 0/0/0 · build · `pnpm test:e2e` (writer) · parent re-ran after merge: test 69/69, check 0/0/0 | T03b + T04 slice: medium (1,355 lines), 1 lens (reliability), approved (`review-efa911754d4ac043`), 4 non-blocking findings routed to T04b |

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

## Next step

T04b: review follow-ups with strict TDD on `feat/astro-rebuild-04b-content-hygiene`, then T05 i18n.
