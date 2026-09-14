import type { RunStatusResponse } from "../../src/runs/types";
import { authHeaders } from "./test-app";

export type Awaitable<T> = T | Promise<T>;
export type AppLike = { fetch: (req: Request) => Awaitable<Response> };

type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timeout",
]);

export async function waitForTerminalStatus(
  app: AppLike,
  runId: string,
  options: WaitOptions = {},
): Promise<RunStatusResponse> {
  const timeoutMs = options.timeoutMs ?? 7000;
  const intervalMs = options.intervalMs ?? 50;
  const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await app.fetch(
      new Request(`http://localhost/api/agent/run/${runId}`, {
        method: "GET",
        headers: authHeaders(),
      }),
    );
    if (response.status !== 200) {
      throw new Error(
        `Failed to read run status for ${runId}, status=${response.status}`,
      );
    }

    const payload = (await response.json()) as RunStatusResponse;
    if (TERMINAL_STATUSES.has(payload.status)) {
      return payload;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Run ${runId} did not reach terminal state within ${timeoutMs}ms (interval ${intervalMs}ms).`,
  );
}
