import { describe, expect, it } from "vitest";

import type { ExtractionResult } from "@wildfires-org/turboplan-document-extraction";

import {
  createDocumentExtractionService,
  type ExtractionUpdate,
  type PendingDocument,
} from "../../../src/documents/extraction-service";
import type { Logger } from "../../../src/infra/logger";

const silentLogger: Logger = {
  log: () => {},
  error: () => {},
};

const doc = (id: string, overrides: Partial<PendingDocument> = {}) => ({
  id,
  url: `https://files.example.com/${id}.pdf`,
  mimeType: "application/pdf",
  originalFilename: `${id}.pdf`,
  ...overrides,
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

type Persisted = { id: string; data: ExtractionUpdate };

describe("document extraction service", () => {
  it("processes a batch sequentially and maps every result kind", async () => {
    const pending = [doc("a"), doc("b"), doc("c")];
    const results: Record<string, ExtractionResult> = {
      "https://files.example.com/a.pdf": {
        ok: true,
        text: "hello",
        truncated: false,
      },
      "https://files.example.com/b.pdf": {
        ok: false,
        reason: "unsupported-format",
        message: "PDF is encrypted",
      },
      "https://files.example.com/c.pdf": {
        ok: false,
        reason: "fetch-failed",
        message: "404",
      },
    };

    const persisted: Persisted[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    let served = false;

    const service = createDocumentExtractionService({
      fetchPending: async () => {
        if (served) {
          return [];
        }
        served = true;
        return pending;
      },
      persist: async (id, data) => {
        persisted.push({ id, data });
      },
      runExtraction: async ({ url }) => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrent -= 1;
        return results[url];
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => persisted.length === 3);
    await service.stop();

    expect(maxConcurrent).toBe(1);
    expect(persisted.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(persisted[0].data).toEqual({
      extractionStatus: "done",
      extractedText: "hello",
      extractionError: null,
    });
    expect(persisted[1].data).toEqual({
      extractionStatus: "unsupported",
      extractedText: null,
      extractionError: "PDF is encrypted",
    });
    expect(persisted[2].data).toEqual({
      extractionStatus: "failed",
      extractedText: null,
      extractionError: "404",
    });

    const status = service.getStatus();
    expect(status.processed).toBe(1);
    expect(status.failed).toBe(2);
    expect(status.inFlight).toBe(false);
    expect(status.lastRunAt).not.toBeNull();
  });

  it("wake() triggers an immediate run without waiting for the poll interval", async () => {
    const persisted: Persisted[] = [];
    let batches = 0;

    const service = createDocumentExtractionService({
      // Long enough that only wake() can produce a run within the test.
      pollIntervalMs: 60_000,
      fetchPending: async () => {
        batches += 1;
        return batches === 1 ? [] : [doc("late")];
      },
      persist: async (id, data) => {
        persisted.push({ id, data });
      },
      runExtraction: async () => ({ ok: true, text: "x", truncated: false }),
      logger: silentLogger,
    });

    service.start();
    // wake() is a no-op while a pass is in flight, so wait for the first
    // (empty) pass to settle before nudging the loop again.
    await waitFor(() => batches === 1 && !service.getStatus().inFlight);
    expect(persisted).toHaveLength(0);

    service.wake();
    await waitFor(() => persisted.length === 1);
    await service.stop();

    expect(persisted[0].id).toBe("late");
  });

  it("keeps processing the batch when a persist call fails", async () => {
    const attempted: string[] = [];
    let served = false;

    const service = createDocumentExtractionService({
      fetchPending: async () => {
        if (served) {
          return [];
        }
        served = true;
        return [doc("a"), doc("b")];
      },
      persist: async (id) => {
        attempted.push(id);
        if (id === "a") {
          throw new Error("db down");
        }
      },
      runExtraction: async () => ({ ok: true, text: "x", truncated: false }),
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => attempted.length === 2);
    await service.stop();

    expect(attempted).toEqual(["a", "b"]);
  });

  it("stop() waits for the in-flight batch to finish", async () => {
    const gate = createDeferred<void>();
    const persisted: Persisted[] = [];
    let served = false;

    const service = createDocumentExtractionService({
      fetchPending: async () => {
        if (served) {
          return [];
        }
        served = true;
        return [doc("slow")];
      },
      persist: async (id, data) => {
        persisted.push({ id, data });
      },
      runExtraction: async () => {
        await gate.promise;
        return { ok: true, text: "done", truncated: false };
      },
      logger: silentLogger,
    });

    service.start();
    await waitFor(() => service.getStatus().inFlight);

    let stopResolved = false;
    const stopping = service.stop().then(() => {
      stopResolved = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopResolved).toBe(false);
    expect(persisted).toHaveLength(0);

    gate.resolve();
    await stopping;

    expect(stopResolved).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(service.getStatus().inFlight).toBe(false);
  });
});
