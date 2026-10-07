import type { Context } from "hono";

import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";

/**
 * Handles route errors consistently across all research-agent routers.
 */
export const handleRouteError = (c: Context, label: string, error: unknown) => {
  console.error(`[${label}] Error:`, error);
  return c.json({ error: "Internal server error" }, 500);
};

/**
 * Run `task` on its own DB connection, detached from the request's lifetime.
 * On Workers, waitUntil keeps the isolate (and that connection) alive until it
 * settles, even after the response ends or the client disconnects; a bare
 * promise would be reaped with the request. Other runtimes (Bun) have no
 * executionCtx, and the promise simply survives on its own. Returns the task's
 * promise, so the caller may still await its result.
 */
export const runDetached = <T>(
  c: Context,
  task: () => Promise<T>,
): Promise<T> => {
  const promise = runWithWorkerConnection(task);
  try {
    c.executionCtx.waitUntil(promise.catch(() => undefined));
  } catch {
    // No executionCtx outside Workers — the promise is already running.
  }
  return promise;
};

/** Fire-and-forget {@link runDetached}: failures are logged, never surfaced. */
export const runInBackground = (
  c: Context,
  label: string,
  task: () => Promise<unknown>,
): void => {
  runDetached(c, task).catch((error: unknown) => {
    console.error(`[${label}] Background task failed:`, error);
  });
};
