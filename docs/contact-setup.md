# Contact and CV setup

What the owner sets up once, outside the repository, so the contact area of the site works.
Nothing here is committed as a value: the CV PDFs live in an R2 bucket, and the keys the
contact form needs are Worker secrets.

Run every `wrangler` command from the repository root as `pnpm exec wrangler ...`, after
`pnpm install`.

- [CV download (R2)](#cv-download-r2)
- [Contact settings](#contact-settings)
- [EmailJS: email delivery](#emailjs-email-delivery)
- [Turnstile: spam protection](#turnstile-spam-protection)
- [Putting the secrets in place](#putting-the-secrets-in-place)
- [Contact troubleshooting](#contact-troubleshooting)

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

## Contact settings

The contact form needs eight settings from the Worker's environment (six required, two
optional test seams) and one binding. `createContactDeps`
(`src/modules/contact/adapters/create-contact-deps.ts`) checks them all in one pass, through
`parseContactConfig` (`src/modules/contact/config.ts`) for the settings, and reports the names
of whatever is missing or invalid, never a value. A blank value counts as missing.

| Setting                | Required | What it is for                                                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `TURNSTILE_SITE_KEY`   | yes      | The public key of the Turnstile widget on the contact page. Browsers see it by design.                 |
| `TURNSTILE_SECRET_KEY` | yes      | Secret. The key the Worker uses to ask Turnstile whether a submission's token is genuine.              |
| `EMAILJS_SERVICE_ID`   | yes      | The EmailJS email service that sends through the owner's Gmail.                                        |
| `EMAILJS_TEMPLATE_ID`  | yes      | The EmailJS template that lays out the message the owner receives.                                     |
| `EMAILJS_PUBLIC_KEY`   | yes      | The EmailJS account's public key.                                                                      |
| `EMAILJS_PRIVATE_KEY`  | yes      | Secret. The EmailJS account's private key (its access token); only the Worker holds it.                |
| `EMAILJS_API_URL`      | no       | Test seam: replaces the EmailJS send endpoint. Leave it blank everywhere except the e2e tests.         |
| `TURNSTILE_VERIFY_URL` | no       | Test seam: replaces Turnstile's verification endpoint. Leave it blank everywhere except the e2e tests. |

The two seams let the end-to-end tests point the Worker at a fake server on `http://127.0.0.1`.
Left blank, each provider's own endpoint is used. When set, the value must be an `https:` URL
(any host) or an `http:` URL whose host is `127.0.0.1`, `localhost` or `[::1]`. The requests to
these endpoints carry the EmailJS private key and the Turnstile secret key, so a plain-text hop
to any other machine is refused, and anything else is reported as invalid.

The real values of `TURNSTILE_SECRET_KEY` and the four `EMAILJS_*` settings never go into git:
they are Worker secrets in Cloudflare and, for local development, entries in `.dev.vars`, which
git ignores. `TURNSTILE_SITE_KEY` is public by design and is set as a plain variable.

The binding is `CONTACT_RATE_LIMIT`, a Workers Rate Limiting binding that counts requests per
client IP. It is not a setting, so there is no value to look up: the change that adds the
contact page declares it in `wrangler.jsonc`, and nothing needs creating in the dashboard. A
missing binding is reported as a missing setting named `CONTACT_RATE_LIMIT`, and one without a
`limit` function as invalid. Cloudflare counts per location and does not promise exact numbers,
so the limit is a soft layer: Turnstile is the real gate.

## EmailJS: email delivery

The form sends each message through EmailJS, called from the Worker and never from the browser.
EmailJS sends it through your own Gmail, from a template whose recipient is fixed to you, with
the visitor's address in Reply-To. The free plan allows 200 requests a month and 1 request a
second. The Worker makes one request per message and never retries, so a failed delivery costs
at most one request.

Menu names below are EmailJS's at the time of writing and may move; the quoted names are what to
look for.

1. Create an account at [emailjs.com](https://www.emailjs.com/) and connect your Gmail under
   Email Services (Add New Service, then Gmail). The service's ID is `EMAILJS_SERVICE_ID`.
   Connecting is an OAuth grant that lets EmailJS send as you; revoke it from your Google
   account if you stop using EmailJS.

2. Create the template under Email Templates (Create New Template):

   | Field     | Value                                                        |
   | --------- | ------------------------------------------------------------ |
   | To Email  | Your own address, typed in. Not a `{{variable}}`.            |
   | Reply-To  | `{{reply_to}}`                                               |
   | From Name | `{{from_name}}`                                              |
   | Subject   | Anything, for example `Portfolio message from {{from_name}}` |
   | Content   | The message and its language, for example the lines below    |

   ```text
   From: {{from_name}} <{{reply_to}}>
   Language: {{locale}}

   {{message}}
   ```

   The recipient stays fixed so that the template can only ever mail you. The Worker sends
   exactly four parameters, `from_name`, `reply_to`, `message` and `locale`, so those are the
   only variables the template can use. The template's ID is `EMAILJS_TEMPLATE_ID`.

3. On the Account page, copy the Public Key (`EMAILJS_PUBLIC_KEY`).

4. Under Account > Security, turn on "Allow EmailJS API for non-browser applications", and use
   the private key listed there (`EMAILJS_PRIVATE_KEY`). EmailJS refuses API calls from
   anything but a browser until this is on, and the Worker is not a browser. It sends the
   private key as the request's `accessToken`, so treat it as a secret.

| Setting               | Where it comes from                                |
| --------------------- | -------------------------------------------------- |
| `EMAILJS_SERVICE_ID`  | The Gmail service under Email Services.            |
| `EMAILJS_TEMPLATE_ID` | The template under Email Templates.                |
| `EMAILJS_PUBLIC_KEY`  | The Public Key on the Account page.                |
| `EMAILJS_PRIVATE_KEY` | The private key under Account > Security (secret). |

Sources: [the send endpoint](https://www.emailjs.com/docs/rest-api/send/) and
[the template editor](https://www.emailjs.com/docs/tutorial/creating-email-template/).

## Turnstile: spam protection

Every submission must carry a Turnstile token, and the Worker checks it with Turnstile before
it sends anything. The widget that produces the token needs JavaScript in the visitor's browser.

1. In the Cloudflare dashboard, open Turnstile and add a widget. Give it the hostname
   `carlos15erh.workers.dev` and leave the mode on Managed. A hostname also covers its
   subdomains ("the widget will work on that exact hostname and all of its subdomains"), so the
   branch previews at `<branch>-portfolio-project.carlos15erh.workers.dev` are covered too.
   Cloudflare's documentation does not say whether a `workers.dev` hostname is accepted, and
   creating the widget is how to find out: if the dashboard refuses it, report that before
   building on it.

2. Copy the widget's site key into `TURNSTILE_SITE_KEY` (public: it ends up in the page) and
   its secret key into `TURNSTILE_SECRET_KEY` (secret).

For local work and the automated tests, use Cloudflare's published test keys instead of a real
widget. They need no account, and a site key and a secret key of the same behavior go together:
a real secret key rejects the dummy token the test site keys produce.

| Behavior            | Site key                   | Secret key                            |
| ------------------- | -------------------------- | ------------------------------------- |
| Always passes       | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always fails        | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| Token already spent | not applicable             | `3x0000000000000000000000000000000AA` |

[Source: Cloudflare's testing page](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

How the Worker uses the answer, so a failure is easy to read:

- It POSTs the secret key, the token and the visitor's IP (when Cloudflare reports one) to
  Turnstile's siteverify endpoint, once, and gives up after 8 seconds. A token is single use and
  valid for 5 minutes, so there is no retry.
- Only an answer of `success: true` lets a submission through. A token longer than 2,048
  characters, Turnstile's documented maximum, is refused without asking.
- An answer of `success: false` whose error codes blame the visitor's token
  (`missing-input-response`, `invalid-input-response`, `timeout-or-duplicate`) is an ordinary
  "no": the submission fails and nothing is logged. When the codes include one that blames the
  secret, the request or Turnstile itself (`missing-input-secret`, `invalid-input-secret`,
  `bad-request`, `internal-error`), the token was never judged, so the submission fails and the
  code is logged (see [Contact troubleshooting](#contact-troubleshooting)). A code in neither
  list is one the Worker does not know. It proves nothing about the token either, so the
  submission fails and the verifier line is logged with no code: the unknown code is Turnstile's
  text, and the Worker never logs it. The two lists are all seven codes in Cloudflare's table as
  of 2026-10-04, so an unknown code is a new one or an undocumented one. Any other HTTP status,
  an answer that is not JSON, a network error or a timeout fails the submission as well.
- What the visitor is told depends on which of the two it was, and nothing is sent in either
  case. A token that is missing or that Turnstile refused (the ordinary "no") is
  `verification_failed`: trying again can help. Every failure that is logged, because Turnstile
  could not judge the token, is `unavailable`: the fault is on the server's side and trying
  again cannot help, so the visitor is pointed to email and WhatsApp instead of being asked to
  retry.
- It does not check the `hostname` Turnstile reports back, because previews run on other
  hostnames than production.

[Source: server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Putting the secrets in place

Five of the eight settings are secrets: `TURNSTILE_SECRET_KEY` and the four `EMAILJS_*`
settings. Never write a value into the repository, an issue or a log.

**Production.** Store each secret on the deployed Worker, one command per setting. Wrangler
asks for the value, so it never lands in your shell history. Run these yourself, after
`pnpm exec wrangler login` (see [CV download](#first-time-setup)):

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put EMAILJS_SERVICE_ID
pnpm exec wrangler secret put EMAILJS_TEMPLATE_ID
pnpm exec wrangler secret put EMAILJS_PUBLIC_KEY
pnpm exec wrangler secret put EMAILJS_PRIVATE_KEY
```

`TURNSTILE_SITE_KEY` is public, so it is a plain variable in `wrangler.jsonc` (under `vars`),
which the contact page's change adds, rather than a secret.

**Local development.** Put the settings in `.dev.vars` in the repository root, which git
ignores. Cloudflare's test keys make Turnstile pass without a real widget:

```ini
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
EMAILJS_SERVICE_ID=<your service id>
EMAILJS_TEMPLATE_ID=<your template id>
EMAILJS_PUBLIC_KEY=<your public key>
EMAILJS_PRIVATE_KEY=<your private key>
```

With real EmailJS values, submitting the local form sends a real email and spends one of the
200 monthly requests. Use fake values to see the form fail safely instead.

## Contact troubleshooting

The Worker never logs what a provider said: a provider's error can quote a key or the visitor's
message. A line names the step that failed and, for the email sender and the Turnstile verifier,
may end with one closed detail in brackets: the HTTP status the provider answered with, as in
`(HTTP 403)`, or, for Turnstile, one of its error codes, as in `(invalid-input-secret)`. Nothing
else of a failure is logged.

| Worker log line                                                                          | What it means                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contact: the email sender failed`                                                       | EmailJS could not be asked: the request failed on the network or took more than 8 s.                                                                                                                                                                   |
| `contact: the email sender failed (HTTP <status>)`                                       | EmailJS answered with that status instead of 200. See the first item below.                                                                                                                                                                            |
| `contact: the Turnstile verifier failed, so the submission was rejected`                 | Turnstile could not be asked (an answer that is not JSON, a network error, no answer in 8 s) or it listed an error code the Worker does not know. The code lists match Cloudflare's table as of 2026-10-04, so an unknown code is new or undocumented. |
| `contact: the Turnstile verifier failed, so the submission was rejected (HTTP <status>)` | Turnstile answered with that status instead of 200. Its documentation gives no HTTP status for an error answer, so what a status means is not documented.                                                                                              |
| `contact: the Turnstile verifier failed, so the submission was rejected (<code>)`        | Turnstile answered 200 but blamed the secret, the request or itself instead of the token. See the second item below.                                                                                                                                   |
| `contact: the rate limiter failed, so the request was let through`                       | The `CONTACT_RATE_LIMIT` binding did not answer. The request went on, and the form still works.                                                                                                                                                        |

- **Messages are not delivered (`contact: the email sender failed`).** The status in brackets is
  what EmailJS answered, and a line with no status means the request never got an answer.
  EmailJS documents one error for its send endpoint, 400 with the text "The user_id parameter is
  required", and the Worker does not log that text. What it answers for anything else, 403 and
  429 included, is not documented, so read those two as "EmailJS refused the request", not as a
  known cause. A 5xx is a server-side error by HTTP's own definition, so a later retry may work.
  Check, in order: Account > Security has "Allow EmailJS API for non-browser applications" on and
  the private key is current; the four `EMAILJS_*` secrets match the dashboard (EmailJS does not
  document what it answers for a wrong id or key); and the plan limits, 200 requests a month and
  1 a second, are not used up.
- **Every submission fails verification, and the line ends in a code.** A wrong or mismatched
  `TURNSTILE_SECRET_KEY` is the usual cause, and the log says so: the verifier line ends in the
  error code Turnstile reported, one of four. When Turnstile lists several, the line names the
  first one in the order below, so the same fault always reads the same.
  - `(missing-input-secret)` or `(invalid-input-secret)`: check `TURNSTILE_SECRET_KEY`. It must
    be the secret key of the same widget as the site key, and a test key must not be paired with
    a real one.
  - `(bad-request)`: Turnstile says the request was malformed. The Worker builds that request,
    so this is a bug to report.
  - `(internal-error)`: the problem is on Turnstile's side, and a later attempt may work.
- **A submission fails verification and there is no log line.** The token was refused, which is
  the ordinary "no", so the keys are not the problem: it was missing or too long (the Worker
  does not even ask Turnstile), or Turnstile said it was invalid, expired or already used. An
  error code the Worker does not know is not silent: it leaves the verifier line with no
  suffix. See the next item.
- **A token fails after it worked in a test.** Turnstile tokens are single use and valid for
  5 minutes: a token that was already checked is rejected, as is an expired one.
