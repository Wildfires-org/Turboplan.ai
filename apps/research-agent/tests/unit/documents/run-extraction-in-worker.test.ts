import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A worker that never answers, so only the timeout can settle the run.
const spawned = vi.hoisted(() => ({ terminated: 0 }));

vi.mock("node:worker_threads", async () => {
  const { EventEmitter: Emitter } = await import("node:events");
  class SilentWorker extends Emitter {
    terminate() {
      spawned.terminated += 1;
      return Promise.resolve(0);
    }
  }
  return { Worker: SilentWorker };
});

import {
  resolveExtractionTimeoutMs,
  runExtractionInWorker,
} from "../../../src/documents/run-extraction-in-worker";

const DOC_MIME = "application/msword";
const PDF_MIME = "application/pdf";

describe("resolveExtractionTimeoutMs", () => {
  it("gives legacy .doc files a much shorter budget than other documents", () => {
    const docTimeout = resolveExtractionTimeoutMs(DOC_MIME);
    const pdfTimeout = resolveExtractionTimeoutMs(PDF_MIME);

    // Above the extractor's 30s fetch timeout, well below the default.
    expect(docTimeout).toBeGreaterThan(30_000);
    expect(pdfTimeout).toBeGreaterThan(docTimeout);
    expect(
      resolveExtractionTimeoutMs(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(pdfTimeout);
  });

  it("matches the .doc type in any case", () => {
    expect(resolveExtractionTimeoutMs(" Application/MSWord ")).toBe(
      resolveExtractionTimeoutMs(DOC_MIME),
    );
  });
});

describe("runExtractionInWorker timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    spawned.terminated = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settledAfter = async (mimeType: string, elapsedMs: number) => {
    let result: unknown = null;
    void runExtractionInWorker({
      url: "https://files.example.com/a",
      mimeType,
    }).then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(elapsedMs);
    return result;
  };

  it("uses the .doc budget by default for a .doc", async () => {
    const budget = resolveExtractionTimeoutMs(DOC_MIME);

    expect(await settledAfter(DOC_MIME, budget - 1)).toBeNull();
    const result = await settledAfter(DOC_MIME, budget);

    expect(result).toMatchObject({
      ok: false,
      reason: "extraction-failed",
      detail: `Extraction timed out after ${budget}ms`,
    });
    expect(spawned.terminated).toBeGreaterThan(0);
  });

  it("gives a PDF the longer default budget and PDF-specific advice", async () => {
    const docBudget = resolveExtractionTimeoutMs(DOC_MIME);
    const pdfBudget = resolveExtractionTimeoutMs(PDF_MIME);

    expect(await settledAfter(PDF_MIME, docBudget)).toBeNull();
    const result = (await settledAfter(PDF_MIME, pdfBudget)) as {
      message: string;
    };

    expect(result.message).toContain("took too long");
    expect(result.message).not.toContain("as PDF");
  });

  it("still honours an explicit timeout", async () => {
    let result: unknown = null;
    void runExtractionInWorker(
      { url: "https://files.example.com/a", mimeType: DOC_MIME },
      { timeoutMs: 10 },
    ).then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(result).toMatchObject({ detail: "Extraction timed out after 10ms" });
  });
});
