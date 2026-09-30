# Contact and CV setup

What the owner sets up once, outside the repository, so the contact area of the site works.
Nothing here is committed as a value: the CV PDFs live in an R2 bucket, and the keys the
contact form needs are Worker secrets.

Run every `wrangler` command from the repository root as `pnpm exec wrangler ...`, after
`pnpm install`.

- [CV download (R2)](#cv-download-r2)

The contact form's email delivery and spam-protection setup get their own sections when the
form ships.

## CV download (R2)

`/cv/en.pdf` and `/cv/es.pdf` stream the two CV PDFs out of the R2 bucket `portfolio-cv`
through the `CV_BUCKET` binding in `wrangler.jsonc` (route: `src/pages/cv/[locale].pdf.ts`).
The home page's "Download CV" button links to them. The PDFs stay out of git and can be
replaced without a redeploy.

### First-time setup

Do this before the branch that declares the `CV_BUCKET` binding is pushed. Wrangler only
creates a bucket for a binding that has no `bucket_name`; with the name in the config it
expects the bucket to exist already.

1. Sign in to Cloudflare (opens the browser, once per machine):

   ```sh
   pnpm exec wrangler login
   ```

2. Create the bucket. Its name must match `bucket_name` in `wrangler.jsonc`:

   ```sh
   pnpm exec wrangler r2 bucket create portfolio-cv
   ```

   If R2 is not enabled on the account yet, Cloudflare asks you to enable it first and may ask
   for a payment method. One CV in two languages stays far inside the free tier (10 GB of
   storage, 1 million writes and 10 million reads a month, free egress).

3. Upload both PDFs. The object names are fixed: `en.pdf` and `es.pdf`. `--remote` is what
   targets the real bucket instead of the local emulation:

   ```sh
   pnpm exec wrangler r2 object put portfolio-cv/en.pdf --file "<path to the English CV>" --content-type application/pdf --remote
   pnpm exec wrangler r2 object put portfolio-cv/es.pdf --file "<path to the Spanish CV>" --content-type application/pdf --remote
   ```

4. After the next deploy, open `<site URL>/cv/en.pdf` and `<site URL>/cv/es.pdf` on a branch
   preview or in production. Each one downloads a file named
   `Carlos-Rodriguez-Huerta-CV-EN.pdf` or `Carlos-Rodriguez-Huerta-CV-ES.pdf`.

### Updating a CV

Run the same upload command again for that language. It replaces the object, and visitors get
the new file within five minutes. The route answers with an `ETag` and
`Cache-Control: public, max-age=300, must-revalidate`, so a browser or cache that holds the old
file revalidates after that time and downloads the new one. No build or deploy is involved.

Keep both objects in the bucket. The home page links to both, and a missing object answers
`404 Not found` (never cached, so uploading it fixes the link at once).

### Previews

`wrangler.jsonc` declares the bucket twice: at the top level, which `wrangler deploy` and
`wrangler versions upload` use, and under `previews`, which `wrangler preview` uses because
Worker Previews do not inherit bindings. Both point at `portfolio-cv`, so every deployment
serves the same two PDFs. There is no staging bucket.

### Local development and tests

`pnpm dev` and `pnpm preview` run the Worker in a local emulation of Cloudflare. Its R2 bucket
starts empty (state lives in `.wrangler/state`, which git ignores), so `/cv/en.pdf` answers
404 until you seed it.

- Synthetic test PDFs (`e2e/fixtures`, one page each, no personal data): `pnpm e2e:seed`.
  `pnpm test:e2e` runs this itself before it starts the preview server.
- Your real CVs: the same upload command with `--local --persist-to .wrangler/state` in place
  of `--remote`, for example:

  ```sh
  pnpm exec wrangler r2 object put portfolio-cv/en.pdf --file "<path to the English CV>" --content-type application/pdf --local --persist-to .wrangler/state
  ```

  `pnpm test:e2e` overwrites the local copies with the test PDFs, so seed your own again
  afterwards.

### Troubleshooting

- **`/cv/en.pdf` answers `404 Not found`.** Either the object is not in the bucket (the Worker
  log says `cv: en.pdf is missing from the bucket`) or the binding is missing (the log says
  `cv: the CV_BUCKET binding is not configured`). Upload the file, or check `wrangler.jsonc`.
- **A deploy fails and mentions `CV_BUCKET` or `portfolio-cv`.** Most likely the bucket does not
  exist on the account yet. Create it (step 2) and retry the deploy.
- **`pnpm check` reports `Cannot find module 'cloudflare:workers'`.** `astro check` needs
  `worker-configuration.d.ts`, which `wrangler types` generates from `wrangler.jsonc` and git
  ignores. `pnpm check` runs `wrangler types` first; `pnpm generate-types` regenerates the file
  on its own.
- **The old CV still downloads after an upload.** Browsers and caches keep a copy for up to five
  minutes. Wait, or reload while bypassing the cache.
