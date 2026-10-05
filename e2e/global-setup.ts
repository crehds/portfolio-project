import { startFakeUpstreams } from './support/fake-upstreams';
import { assertHermeticBuild } from './support/hermetic-guard';
import { UPSTREAM_PORT } from './support/ports';

/**
 * Runs once, after Playwright has started the site and before the first test.
 *
 * It first proves, from the files the server reads, that the site under test will talk to
 * the fake providers and to no real one (`assertHermeticBuild`), and stops the whole run
 * with a clear message when it will not. Only then does it start the fake providers the
 * Worker's seam URLs name. No request goes to the site before that check passes, so a
 * misconfigured run never reaches EmailJS or Turnstile.
 *
 * It returns the function that stops the fakes when the run ends.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  assertHermeticBuild();

  const upstreams = await startFakeUpstreams({ port: UPSTREAM_PORT });

  return () => upstreams.close();
}
