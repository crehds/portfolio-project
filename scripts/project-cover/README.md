# Project cover

The picture of a project on its card and its page: `src/content/projects/<slug>/cover.jpg`,
1280x800, a screenshot of the project's live site.

To recapture one, after its live site changes:

```sh
pnpm cover <slug>
```

`pnpm cover` runs `node scripts/project-cover/capture.mjs`, which takes the same argument.

The script opens the `links.live` address of `src/content/projects/<slug>/en.md` and replaces
`cover.jpg`. Look at the new picture, then commit it. This is a manual tool: neither the build
nor CI runs it.

A project whose live address is an entry page names the button to press first, in
`BUTTON_BEFORE_CAPTURE` at the top of `capture.mjs`. Organizador is the only one: the script
presses "Probar el demo" and captures the task list. Each capture creates a temporary demo
account there, which the app deletes after 24 hours.

| When                                                                             | What to do                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The site answers an error (a site that sleeps when idle can answer 502 at first) | The cover is left as it was. Run the command again.                              |
| The picture shows a cookie notice, a modal or visitor-made demo data             | Run it again later, or reset the demo first. The script takes the page as it is. |
| The project has no `links.live`                                                  | There is nothing to capture; the script says so.                                 |
