# Adding a project / case study

This is the template and reference for one entry in the `projects` content collection
(`src/content/projects/`, schema: `src/modules/projects/schema.ts`). It lives under `docs/`
rather than inside the collection itself: the collection's loader is
`glob({ base: './src/content/projects', pattern: '**/*.md' })`
(`src/content.config.ts`), which loads every Markdown file under that folder, and each
entry's id must be exactly `<slug>/<locale>` with a supported locale
(`src/modules/projects/domain/select-for-locale.ts` throws otherwise). A template file
placed inside the collection would either break that id shape or show up as a fake
project, so it stays here instead.

## File layout

```
src/content/projects/<slug>/en.md
src/content/projects/<slug>/es.md
```

- `<slug>` is a URL-friendly, ASCII, kebab-case identifier (e.g. `game-with-keyboard`). It
  becomes the project's id together with the locale (`<slug>/en`, `<slug>/es`) and,
  eventually, its `/projects/<slug>` route (T09).
- Both `en.md` and `es.md` are required, even if the Spanish (or English) version is a
  direct translation with no differences beyond the language. A missing locale file is
  not caught by the schema (it validates one file at a time) — it is caught by
  `src/content/content-integrity.test.ts`, which fails the build's test suite instead of
  letting the Spanish site silently fall back to the English entry
  (`selectProjectsForLocale`'s fallback behavior is for a translation still in progress,
  not a substitute for shipping one).
- Each file is frontmatter only until a real case-study write-up exists for that project;
  the body (below the closing `---`) is what renders on `/projects/<slug>`.

## Frontmatter fields

| Field        | Type                       | Required                   | Notes                                                                                                                                                                                                                                                                                                                      |
| ------------ | -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`      | string                     | yes                        | The project's display name. Use its own name for the English file; use the legacy Spanish title where one already exists for the Spanish file, otherwise translate/adapt `title` yourself.                                                                                                                                 |
| `summary`    | string                     | yes                        | One sentence, for cards and previews. Write `"TODO(owner): one-line summary"` verbatim (same string in both locales, so it stays grep-able) when there is no verifiable source for a description yet — never invent one.                                                                                                   |
| `role`       | string                     | no                         | Your role on the project (e.g. `"Full-Stack Developer"`), when it is worth stating separately from `summary`.                                                                                                                                                                                                              |
| `stack`      | string[]                   | yes                        | Main frameworks, languages and services only (e.g. `["React", "Express", "MongoDB"]`) — not every dependency in `package.json`. `[]` is valid for a project with no verified stack yet.                                                                                                                                    |
| `links.live` | URL                        | no                         | The deployed site. Omit rather than guess; a stale or dead link is worse than none (liveness is checked later, in T13).                                                                                                                                                                                                    |
| `links.repo` | URL                        | no                         | The `https://` form of the repository, at its root (not a subpath/subfolder deep link).                                                                                                                                                                                                                                    |
| `cover`      | image                      | no                         | Not populated by this template — cover images come from T09 with freshly captured screenshots. Leave unset.                                                                                                                                                                                                                |
| `featured`   | boolean                    | no (default `false`)       | Whether the project appears in the home page's featured list (`featuredProjects`, `src/modules/projects/domain/featured-projects.ts`). **A `draft` project must never be `featured: true`** — `content-integrity.test.ts` enforces this; `featuredProjects` also excludes drafts by default, but don't rely on that alone. |
| `status`     | `"draft"` \| `"published"` | no (default `"published"`) | Use `draft` for a project with no verifiable summary/links yet, or one you are not ready to show — it is excluded from listings unless a caller explicitly opts into drafts. Switch it to `published` once the entry has a real `summary` (and ideally a case-study body).                                                 |
| `date`       | date (`YYYY-MM-DD`)        | yes                        | See "The `date` rule" below.                                                                                                                                                                                                                                                                                               |

### The `cover` is also the social card

A project page shares its cover when someone posts a link to it: the build crops the cover to
1200x630, keeping the top (`src/shared/seo/social-image.ts`), and the page's `og:image` tags point
at the result. Two consequences for a new cover:

- It must be at least 1200 pixels wide and 630 tall. The image service never enlarges a picture, so
  a smaller cover would give a smaller card than the size the tags declare, so the content schema
  fails the build for it (`src/modules/projects/schema.ts`), and `e2e/seo.spec.ts` decodes the card
  of every project page and fails on any other size.
- Put what identifies the project in the top of the screenshot. A 1280x800 capture loses roughly
  its bottom sixth in the card.

### The `date` rule

`date` represents the project's last known activity, not a case study's publish date. Use,
in order of preference:

1. **A project with a git repository you can read**: the date of the latest commit on the
   repository's current branch — `git log -1 --format=%cs` run inside that repo. Re-run it
   (and bump `date`) whenever you next touch that project's entry, so it keeps reflecting
   real activity instead of freezing at whenever this template was first used.
2. **A project with no repository or records** (data lost, external/client-owned code,
   etc.): the date its source material was captured — for example, the commit that added
   its screenshot in this portfolio's history. Document in a commit message or code
   comment which commit and file you used, the same way T06 recorded
   `git log v1-legacy --diff-filter=A --format=%cs -- src/assets/images/<name>_screenshot.png`
   for the two draft projects that predate this rebuild.

Never invent a date, and never reuse another project's date "to be safe" — an inaccurate
`date` is worse than a slightly old but honest one, and `featuredProjects` sorts by it.

## Case-study body outline

Once there is real substance to write (not just basic data), structure the Markdown body
below the frontmatter along these lines. Keep it honest: every claim should be something
you could point to (a commit, a metric you actually measured, a documented decision) —
never a fabricated or hand-typed statistic.

1. **Problem** — what need or pain point the project addresses, for whom.
2. **Role** — what you were specifically responsible for (especially on a team project or
   client engagement).
3. **Approach** — the key technical or product decisions, and why you made them over the
   alternatives.
4. **Results** — outcomes, but only numbers you can verify (a real metric you measured or
   were given, not a guess). If there is nothing verifiable to report, omit this section
   rather than filling it with an invented figure.
5. **Stack** — the technologies that mattered to the story above (this can be more
   detailed/narrative than the frontmatter `stack` list).
6. **Links** — live site and/or repository, repeated in the body for convenience if the
   page design doesn't already surface `links` prominently.

## Blank template

```markdown
---
title: Project Name
summary: 'One sentence describing the project.'
role: 'Your role, if worth stating separately from summary'
stack:
  - Main framework or language
  - Key service
links:
  live: https://example.com
  repo: https://github.com/crehds/project-name
featured: false
status: published
date: 2026-01-01
---

## Problem

## Role

## Approach

## Results

## Stack

## Links
```
