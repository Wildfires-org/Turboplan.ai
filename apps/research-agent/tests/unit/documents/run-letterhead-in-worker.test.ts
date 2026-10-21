import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A worker that never answers, so only the timeout can settle the run.
const spawned = vi.hoisted(() => ({
  terminated: 0,
  options: [] as unknown[],
}));

vi.mock("node:worker_threads", async () => {
  const { EventEmitter: Emitter } = await import("node:events");
  class SilentWorker extends Emitter {
    constructor(_path: URL, options: unknown) {
      super();
      spawned.options.push(options);
    }
    terminate() {
      spawned.terminated += 1;
      return Promise.resolve(0);
    }
  }
  return { Worker: SilentWorker };
});

import { LETTERHEAD_DEADLINE_MS } from "../../../src/documents/letterhead/analysis-task";
import {
  LETTERHEAD_MAX_OLD_GENERATION_MB,
  LETTERHEAD_WORKER_TIMEOUT_MS,
  runLetterheadInWorker,
} from "../../../src/documents/run-extraction-in-worker";
import { createWorkerGate } from "../../../src/documents/worker-gate";

const settings = {
  baseURL: "https://openrouter.ai/api",
  authToken: "sk-or-key",
  model: "anthropic/claude-haiku-4.5",
};

describe("runLetterheadInWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    spawned.terminated = 0;
    spawned.options = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a letterhead task with its own 64 MB heap cap", () => {
    expect(LETTERHEAD_MAX_OLD_GENERATION_MB).toBe(64);

    void runLetterheadInWorker({
      url: "https://files.example.com/letter.pdf",
      settings,
    });

    expect(spawned.options).toEqual([
      {
        workerData: {
          task: "letterhead",
          url: "https://files.example.com/letter.pdf",
          settings,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 48,
        },
      },
    ]);
  });

  it("allows 60 s, beyond the task's own 50 s deadline, then kills the worker", async () => {
    expect(LETTERHEAD_WORKER_TIMEOUT_MS).toBe(60_000);
    expect(LETTERHEAD_DEADLINE_MS).toBeLessThan(LETTERHEAD_WORKER_TIMEOUT_MS);

    let result: unknown = null;
    void runLetterheadInWorker({
      url: "https://files.example.com/letter.pdf",
      settings,
    }).then((value) => {
      result = value;
    });

    await vi.advanceTimersByTimeAsync(LETTERHEAD_WORKER_TIMEOUT_MS - 1);
    expect(result).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({
      ok: false,
      reason: "timeout",
      detail: "Letterhead analysis timed out after 60000ms",
    });
    expect(spawned.terminated).toBeGreaterThan(0);
  });

  it("starts the worker, and its timeout, only once it holds the gate", async () => {
    const gate = createWorkerGate();
    let releaseExtraction!: () => void;
    void gate(
      () =>
        new Promise<void>((resolve) => {
          releaseExtraction = resolve;
        }),
    );

    let result: unknown = null;
    void gate(() =>
      runLetterheadInWorker({
        url: "https://files.example.com/letter.pdf",
        settings,
      }),
    ).then((value) => {
      result = value;
    });

    // Waiting behind a long extraction does not use up the analysis's time.
    await vi.advanceTimersByTimeAsync(LETTERHEAD_WORKER_TIMEOUT_MS * 2);
    expect(spawned.options).toHaveLength(0);
    expect(result).toBeNull();

    releaseExtraction();
    await vi.advanceTimersByTimeAsync(0);
    expect(spawned.options).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(LETTERHEAD_WORKER_TIMEOUT_MS - 1);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toMatchObject({ ok: false, reason: "timeout" });
  });
});
