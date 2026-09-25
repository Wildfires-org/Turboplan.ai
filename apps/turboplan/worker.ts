/**
 * Custom Worker entry for the OpenNext-built Next.js app.
 *
 * Without it, every database access inside the app opens its own Postgres
 * TCP+TLS connection and never closes it (see `getDB()` in
 * `@wildfires-org/turboplan-db`): the Worker runtime forbids sharing I/O objects
 * across requests, so there is no module-level pool to fall back on. This
 * wrapper opens exactly one pooled connection per request and shares it with the
 * Next.js bundle through an AsyncLocalStorage instance pinned to `globalThis`,
 * then closes it once the response body has been delivered.
 *
 * The connection string is passed explicitly rather than read from
 * `process.env`: OpenNext's own env bridge copies the Cloudflare env into
 * `process.env` while handling the request, which would overwrite
 * `POSTGRES_URL` with the raw database secret and bypass Hyperdrive. Hyperdrive
 * is preferred when its binding is present because it pools and multiplexes
 * connections at the edge.
 */

// `open-next-worker` is a wrangler `alias` (see wrangler.jsonc) for the
// generated `.open-next/worker.js`. A bare specifier keeps tsc from following
// the import into the multi-megabyte bundle, which crashes type-checking when a
// stale build is present locally.
// @ts-ignore -- resolved by the wrangler alias at bundle time
import openNextHandler from "open-next-worker";

import { runWithWorkerConnectionForResponse } from "@wildfires-org/turboplan-db/db-client";

type WorkerEnv = {
  HYPERDRIVE?: { connectionString: string };
  POSTGRES_URL?: string;
} & Record<string, unknown>;

type WorkerExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
};

export default {
  fetch: async (
    request: Request,
    env: WorkerEnv,
    ctx: WorkerExecutionContext,
  ): Promise<Response> => {
    const connectionString =
      env.HYPERDRIVE?.connectionString ?? env.POSTGRES_URL;

    if (!connectionString) {
      return openNextHandler.fetch(request, env, ctx);
    }

    return runWithWorkerConnectionForResponse(
      () => openNextHandler.fetch(request, env, ctx),
      {
        waitUntil: (promise) => ctx.waitUntil(promise),
        connectionString,
      },
    );
  },
};

// Required by OpenNext's DO-based queue/tag cache bindings if ever enabled.
export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
  // @ts-ignore -- resolved by the wrangler alias at bundle time
} from "open-next-worker";
