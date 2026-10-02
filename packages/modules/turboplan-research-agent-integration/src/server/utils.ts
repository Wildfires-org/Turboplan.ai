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
 * Run `task` after the response is sent. On Workers, waitUntil keeps the
 * isolate (and the task's own DB connection) alive until it settles; a bare
 * fire-and-forget would be reaped after the response. Other runtimes (Bun)
 * have no executionCtx, and the promise simply survives on its own.
 */
export const runInBackground = (
  c: Context,
  label: string,
  task: () => Promise<unknown>,
): void => {
  const promise = runWithWorkerConnection(task).catch((error: unknown) => {
    console.error(`[${label}] Background task failed:`, error);
  });
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    // No executionCtx outside Workers — the promise is already running.
  }
};
