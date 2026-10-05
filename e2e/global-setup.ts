import { startFakeUpstreams } from './support/fake-upstreams';
import {
  assertHermeticBuild,
  assertServerReadsE2eSettings,
} from './support/hermetic-guard';
import { UPSTREAM_PORT } from './support/ports';

/**
 * Runs once, after Playwright has started the site and before the first test.
 *
 * It first proves, from the files the server reads, that the site under test will talk to
 * the fake providers and to no real one (`assertHermeticBuild`), and stops the whole run
 * with a clear message when it will not. Then it starts the fake providers the Worker's seam
 * URLs name, and checks the running server itself: the contact page it answers must render
 * the site key of `.dev.vars.e2e` (`assertServerReadsE2eSettings`), a plain GET that asks
 * nothing of any provider. Only then does a test run, so a misconfigured run never reaches
 * EmailJS or Turnstile.
 *
 * It returns the function that stops the fakes when the run ends.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  assertHermeticBuild();

  const upstreams = await startFakeUpstreams({ port: UPSTREAM_PORT });

  try {
    await assertServerReadsE2eSettings();
  } catch (error) {
    await upstreams.close();
    throw error;
  }

  return () => upstreams.close();
}
