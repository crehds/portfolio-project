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

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Start the dev server                                   |
| `pnpm build`        | Build the production site into `dist/`                 |
| `pnpm preview`      | Serve the production build locally                     |
| `pnpm check`        | Type-check `.astro` and TypeScript files               |
| `pnpm lint`         | Lint the codebase with ESLint                          |
| `pnpm lint:fix`     | Lint and auto-fix what ESLint can                      |
| `pnpm format`       | Format the codebase with Prettier                      |
| `pnpm format:check` | Check formatting without writing changes               |
| `pnpm test`         | Run unit tests with Vitest                             |
| `pnpm test:e2e`     | Run end-to-end and accessibility tests with Playwright |

## Stack

| Area      | Choice                              |
| --------- | ----------------------------------- |
| Framework | Astro 7 with strict TypeScript      |
| Hosting   | Cloudflare Workers (planned)        |
| Content   | Astro content collections (planned) |

## Roadmap

The rebuild plan, decisions and progress live in
[`odd/tasks/portfolio-astro-rebuild.md`](odd/tasks/portfolio-astro-rebuild.md).

## License

The code is released under the [MIT License](LICENSE). Personal content (texts, images and CV)
is © Carlos Rodríguez Huerta, all rights reserved.
