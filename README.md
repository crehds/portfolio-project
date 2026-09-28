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
| `pnpm check`          | Type-check `.astro` and TypeScript files                     |
| `pnpm lint`           | Lint the codebase with ESLint                                |
| `pnpm lint:fix`       | Lint and auto-fix what ESLint can                            |
| `pnpm format`         | Format the codebase with Prettier                            |
| `pnpm format:check`   | Check formatting without writing changes                     |
| `pnpm test`           | Run unit tests with Vitest                                   |
| `pnpm test:e2e`       | Run end-to-end and accessibility tests with Playwright       |
| `pnpm generate-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |

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
  version there, so the dashboard's build environment variables must include
  `PNPM_VERSION=12.3.4` to match `packageManager` in `package.json`.

## Roadmap

The rebuild plan, decisions and progress live in
[`odd/tasks/portfolio-astro-rebuild.md`](odd/tasks/portfolio-astro-rebuild.md).

## License

The code is released under the [MIT License](LICENSE). Personal content (texts, images and CV)
is © Carlos Rodríguez Huerta, all rights reserved.
