// Helpers the adapter tests share. Only tests import this file.
import { vi } from 'vitest';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/**
 * Silences every console method and returns the spies, so a test can assert that nothing
 * was logged. Restore them with `vi.restoreAllMocks()`.
 */
export function spyOnConsole() {
  return CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
}

/**
 * The `Error` a promise rejects with. It fails the test when the promise resolves or
 * rejects with anything that is not an `Error`.
 */
export async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  const rejection = await promise.then(
    () => undefined,
    (reason: unknown) => ({ reason }),
  );

  if (!rejection) {
    throw new Error('Expected the promise to reject.');
  }
  if (!(rejection.reason instanceof Error)) {
    throw new Error(`Expected an Error, got ${String(rejection.reason)}`);
  }
  return rejection.reason;
}

/**
 * Everything an error exposes that could end up in a log, a response or a report: its
 * name, message and stack, its string and JSON forms, every own property, and its cause.
 */
export function everythingAbout(error: Error): string {
  return [
    error.name,
    error.message,
    error.stack,
    String(error),
    JSON.stringify(error),
    JSON.stringify(Object.getOwnPropertyDescriptors(error)),
    String(error.cause),
  ].join('\n');
}
