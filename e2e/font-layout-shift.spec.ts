import { expect, test } from './support/csp-guard';

// A web font that arrives after the first paint swaps in for the fallback, and any text
// whose width or height differs between the two moves. On the Lighthouse CI runner this cost
// `/skills/` a layout shift of 0.19 (the tag pills wrap differently once Ubuntu Mono lands),
// which took its performance score from 1 to 0.91. A fast local server hides it, so this
// spec holds every font response back long enough for the first paint to happen without the
// fonts, the way a cold visit on a slow network does, and then sums the layout shifts.
//
// The generated fallbacks (`Arial`, `Courier New`, with metrics matched to the web font)
// only help where those fonts are installed, which a Linux runner usually lacks. The spec
// makes every `local()` source unresolvable, so the check does not depend on the machine
// that runs it. It tests the page's whole answer to a late font, not preloading alone: a
// delayed preload is still late, so the pass here comes from the swap not moving the layout
// (the `font-display` choice), whatever the fallback's metrics are.
const FONT_DELAY_MS = 800;
// Lighthouse scores CLS 0.1 or less as good; a page that holds its layout through a late
// font stays well under that, and 0.02 leaves room for sub-pixel rounding only.
const MAX_SHIFT = 0.02;

const paths = [
  '/',
  '/es/',
  '/skills/',
  '/es/skills/',
  '/experience/',
  '/projects/',
];

for (const path of paths) {
  test(`${path} keeps its layout when the web fonts arrive late`, async ({
    page,
  }) => {
    await page.route('**/_astro/fonts/*.woff2', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
      await route.continue();
    });
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document')
        return route.fallback();
      const response = await route.fetch();
      const body = (await response.text()).replaceAll(
        'src:local("',
        'src:local("not-installed-',
      );
      await route.fulfill({ response, body });
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(path, { waitUntil: 'load' });
    // Past the delay, so a font that was going to swap in has done so.
    await page.waitForTimeout(FONT_DELAY_MS + 700);

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    test.info().annotations.push({ type: 'cls', description: String(cls) });
    expect(cls).toBeLessThanOrEqual(MAX_SHIFT);
  });
}
