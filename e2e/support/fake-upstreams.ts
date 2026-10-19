// A stand-in for the two providers the contact form calls, so the end-to-end tests never
// reach EmailJS (200 requests a month, and every one lands in the owner's inbox) or
// Turnstile. The Worker reaches it through the seam URLs in `.dev.vars.e2e`.
//
// It records every request it gets. The tests that run in worker processes cannot see this
// process's memory, so they read the record over HTTP (`upstreamClient`), asking for the
// calls that carry the marker their own test put in the visitor's text or in the token.
// Tests run in parallel and share one fake, so a marker is how a test finds its own calls.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { EMAILJS_PATH, TURNSTILE_PATH } from './ports';

export type UpstreamName = 'emailjs' | 'turnstile' | 'unexpected';

export interface RecordedCall {
  readonly upstream: UpstreamName;
  readonly method: string;
  readonly path: string;
  /** EmailJS: the parsed JSON. Turnstile: the form fields. Anything else: the raw text. */
  readonly body: unknown;
}

export interface FakeUpstreams {
  readonly origin: string;
  readonly emailjsUrl: string;
  readonly turnstileUrl: string;
  close(): Promise<void>;
}

/**
 * How a Turnstile token steers the fake's answer. The token is
 * `<scenario>:<marker>`, so one string says what happens and tags the call.
 *
 * - `pass`: `success: true`, solved on `carlos15erh.workers.dev`, the host the Worker allows.
 * - `foreign-host`: `success: true`, but solved on a look-alike of that host: a genuine token
 *   that belongs to some other site, which the Worker must refuse.
 * - `refuse`: the token is not accepted (`invalid-input-response`).
 * - `duplicate`: the token was already used (`timeout-or-duplicate`).
 * - `fault`: Turnstile blames the secret (`invalid-input-secret`), so it never judged
 *   the token.
 * - `unknown-code`: an error code nobody documented.
 * - `http-500`: Turnstile itself is down.
 */
export const TURNSTILE_SCENARIOS = [
  'pass',
  'foreign-host',
  'refuse',
  'duplicate',
  'fault',
  'unknown-code',
  'http-500',
] as const;

export type TurnstileScenario = (typeof TURNSTILE_SCENARIOS)[number];

export function turnstileToken(
  scenario: TurnstileScenario,
  marker: string,
): string {
  return `${scenario}:${marker}`;
}

/**
 * A text to put in a visitor's message so that the fake EmailJS answers with `status`
 * instead of 200, as in `[[fake-emailjs:500]]`.
 */
export function emailjsFailure(status: number): string {
  return `[[fake-emailjs:${status}]]`;
}

const EMAILJS_FAILURE = /\[\[fake-emailjs:(\d{3})\]\]/;
const MAX_BODY_BYTES = 1024 * 1024;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('The fake upstream refuses a body over 1 MiB.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function turnstileAnswer(token: string): {
  status: number;
  body: unknown;
} {
  const scenario = token.split(':')[0];

  switch (scenario) {
    case 'pass':
      return {
        status: 200,
        body: {
          success: true,
          'error-codes': [],
          hostname: 'carlos15erh.workers.dev',
        },
      };
    case 'foreign-host':
      return {
        status: 200,
        body: {
          success: true,
          'error-codes': [],
          hostname: 'carlos15erh.workers.dev.attacker.example',
        },
      };
    case 'duplicate':
      return {
        status: 200,
        body: { success: false, 'error-codes': ['timeout-or-duplicate'] },
      };
    case 'fault':
      return {
        status: 200,
        body: { success: false, 'error-codes': ['invalid-input-secret'] },
      };
    case 'unknown-code':
      return {
        status: 200,
        body: { success: false, 'error-codes': ['e2e-unknown-code'] },
      };
    case 'http-500':
      return { status: 500, body: 'fake turnstile failure' };
    // `refuse`, and any token that is not one of the scenarios: a typo in a test must not
    // turn into a pass.
    default:
      return {
        status: 200,
        body: { success: false, 'error-codes': ['invalid-input-response'] },
      };
  }
}

/**
 * Starts the fake providers on `127.0.0.1`. `port: 0` takes any free port, which is what
 * the harness's own tests use; `globalSetup` starts the one the Worker is pointed at.
 * Rejects when the port is taken, so a second run cannot silently talk to the first one's
 * fake.
 */
export async function startFakeUpstreams(
  options: { port?: number } = {},
): Promise<FakeUpstreams> {
  const calls: RecordedCall[] = [];

  const record = (call: RecordedCall) => {
    calls.push(call);
  };

  const server: Server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const method = request.method ?? 'GET';
      const send = (
        status: number,
        body: unknown,
        type = 'application/json',
      ) => {
        response.writeHead(status, { 'content-type': type });
        response.end(typeof body === 'string' ? body : JSON.stringify(body));
      };

      if (method === 'GET' && url.pathname === '/__health') {
        send(200, { ok: true, role: 'e2e-fake-upstreams' });
        return;
      }

      if (method === 'GET' && url.pathname === '/__calls') {
        const marker = url.searchParams.get('marker');
        if (!marker) {
          send(400, { error: 'marker is required' });
          return;
        }
        send(
          200,
          calls.filter((call) => JSON.stringify(call.body).includes(marker)),
        );
        return;
      }

      if (method === 'GET' && url.pathname === '/__unexpected') {
        send(
          200,
          calls.filter((call) => call.upstream === 'unexpected'),
        );
        return;
      }

      const text = await readBody(request);

      if (method === 'POST' && url.pathname === EMAILJS_PATH) {
        const body = parseJson(text);
        record({ upstream: 'emailjs', method, path: url.pathname, body });

        const status = EMAILJS_FAILURE.exec(text)?.[1];
        if (status) {
          send(Number(status), 'fake emailjs failure', 'text/plain');
          return;
        }
        // The real service answers 200 with the text OK.
        send(200, 'OK', 'text/plain');
        return;
      }

      if (method === 'POST' && url.pathname === TURNSTILE_PATH) {
        const fields = Object.fromEntries(new URLSearchParams(text));
        record({
          upstream: 'turnstile',
          method,
          path: url.pathname,
          body: fields,
        });

        const answer = turnstileAnswer(fields.response ?? '');
        send(
          answer.status,
          answer.body,
          typeof answer.body === 'string' ? 'text/plain' : 'application/json',
        );
        return;
      }

      record({
        upstream: 'unexpected',
        method,
        path: url.pathname,
        body: text,
      });
      send(404, 'not a fake endpoint', 'text/plain');
    })().catch(() => {
      response.writeHead(500).end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(
              `The fake upstreams cannot start: port ${options.port} is already in use ` +
                `(EADDRINUSE). Another end-to-end run may still be going; stop it first.`,
            )
          : error,
      );
    });
    server.listen(options.port ?? 0, '127.0.0.1', () => resolve());
  });

  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    origin,
    emailjsUrl: `${origin}${EMAILJS_PATH}`,
    turnstileUrl: `${origin}${TURNSTILE_PATH}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

/** Reads what a running fake recorded. Safe to use from any test worker. */
export function upstreamClient(origin: string) {
  async function getJson(pathAndQuery: string): Promise<unknown> {
    const response = await fetch(`${origin}${pathAndQuery}`);
    if (!response.ok) {
      throw new Error(
        `The fake upstreams answered ${response.status} to ${pathAndQuery}.`,
      );
    }
    return response.json();
  }

  return {
    health: () => getJson('/__health'),
    /** The calls whose body carries `marker`, in the order they arrived. */
    callsFor: async (marker: string) =>
      (await getJson(
        `/__calls?marker=${encodeURIComponent(marker)}`,
      )) as RecordedCall[],
    /** The requests that were for neither provider endpoint. */
    unexpectedCalls: async () =>
      (await getJson('/__unexpected')) as RecordedCall[],
  };
}

/**
 * What the record of unexpected calls (`unexpectedCalls`) says about the run, as a list of
 * problems: one for each method and path that was called, with how many times when it was
 * more than once, in the order each first came. A problem names the method and the path and
 * nothing else, since the record keeps the body of each request, and a body can hold a
 * visitor's text or a token.
 */
export function unexpectedCallProblems(
  calls: readonly RecordedCall[],
): string[] {
  const counts = new Map<string, number>();

  for (const { method, path } of calls) {
    const call = `${method} ${path}`;
    counts.set(call, (counts.get(call) ?? 0) + 1);
  }

  return [...counts].map(([call, count]) =>
    count === 1 ? call : `${call} (${count} times)`,
  );
}
