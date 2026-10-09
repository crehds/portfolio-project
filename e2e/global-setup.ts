import {
  startFakeUpstreams,
  unexpectedCallProblems,
  upstreamClient,
} from './support/fake-upstreams';
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
 * It returns the function that ends the fakes when the run ends. It reads what they recorded
 * for a path that is neither provider endpoint, stops them, and fails the run when there was
 * any such call (`unexpectedCallProblems`): the Worker should reach only the two endpoints
 * `.dev.vars.e2e` names, and a call anywhere else means a seam URL is wrong or the site now
 * calls something new.
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

  return async () => {
    try {
      const problems = unexpectedCallProblems(
        await upstreamClient(upstreams.origin).unexpectedCalls(),
      );

      if (problems.length > 0) {
        throw new Error(
          `The fake upstreams were called at paths that are neither the EmailJS nor the Turnstile endpoint:\n` +
            problems.map((problem) => `  - ${problem}`).join('\n'),
        );
      }
    } finally {
      await upstreams.close();
    }
  };
}
