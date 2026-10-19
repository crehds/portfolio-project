# Default social card

The picture that a link preview shows for every page without a project cover:
`src/assets/og/og-card-en.png` and `og-card-es.png`, 1200x630, drawn on the dark theme (the
`>_` mark, the name in Ubuntu Bold, the role in Ubuntu Mono).

The colors come from the dark tokens in `src/styles/tokens.css`, the name and the role from
`src/content/profile.yaml`, and the fonts from Astro's font cache. No font file is committed.

To regenerate the two PNGs, after a change of the accent color or the profile text:

```sh
pnpm build                          # once: fills node_modules/.astro/fonts
node scripts/social-card/render.mjs
```

Then commit the PNGs. This is a manual tool: neither the build nor CI runs it.
