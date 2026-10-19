# Site icons

`public/icon.svg`, `public/favicon.ico` (32 and 48 pixel) and `public/apple-touch-icon.png`
(180x180, opaque): a cyan `>_` mark on a dark rounded square. It is the dark variant in both color
schemes, so the SVG needs no `prefers-color-scheme` switch.

The colors are the dark background and the dark accent of `src/styles/tokens.css`.
`src/styles/icons.test.ts` reads both files and fails when `icon.svg` no longer matches the tokens,
so after changing either token (the accent, T10d) regenerate the icons:

```sh
node scripts/icons/render.mjs
```

Then commit the three files. This is a manual tool: neither the build nor CI runs it. It needs the
Chromium that Playwright already installs for the e2e suite.

The `theme-color` tags in the layout follow the same tokens (`src/shared/theme/theme-color.ts`);
the same test checks them.
