// Recaptures a project's cover, src/content/projects/<slug>/cover.jpg (1280x800), from its
// live site.
//
//   node scripts/project-cover/capture.mjs <slug>
//
// A manual tool: it is not part of the build or of CI. Run it after the project's live site
// changes, look at the new picture, and commit it.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const slug = process.argv[2] ?? '';
// The slug becomes part of a path, so it may only be a folder name.
if (!/^[a-z0-9-]+$/.test(slug)) {
  throw new Error('Usage: node scripts/project-cover/capture.mjs <slug>');
}

const projectDir = path.join(repoRoot, 'src', 'content', 'projects', slug);
const entry = path.join(projectDir, 'en.md');
if (!existsSync(entry)) {
  throw new Error(
    `No project "${slug}": ${path.relative(repoRoot, entry)} does not exist.`,
  );
}

// `links.live` is the same in both locales; only the frontmatter is searched.
const frontmatter = readFileSync(entry, 'utf8').split('\n---')[0];
const live = /^\s+live:\s*(\S+)/m.exec(frontmatter)?.[1];
if (!live) {
  throw new Error(`"${slug}" has no links.live to capture.`);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    // Some sites format dates by the browser language; a fixed one keeps captures alike.
    locale: 'en-US',
  });
  const response = await page.goto(live, { waitUntil: 'networkidle' });
  // An error page must not replace a good cover. A site that sleeps when idle can answer
  // 502 on the first request: run the command again.
  if (!response?.ok()) {
    throw new Error(
      `${live} answered ${response?.status() ?? 'nothing'}; cover not changed.`,
    );
  }
  const file = path.join(projectDir, 'cover.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  console.log(`wrote ${path.relative(repoRoot, file)} from ${page.url()}`);
} finally {
  await browser.close();
}
