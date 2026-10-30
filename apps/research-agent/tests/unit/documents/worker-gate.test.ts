import { describe, expect, it } from "vitest";

import { createWorkerGate } from "../../../src/documents/worker-gate";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createWorkerGate", () => {
  it("runs one task at a time, the next only once the previous settled", async () => {
    const gate = createWorkerGate();
    const events: string[] = [];
    const extraction = deferred<string>();
    const letterhead = deferred<string>();

    const first = gate(async () => {
      events.push("extraction started");
      return extraction.promise;
    });
    const second = gate(async () => {
      events.push("letterhead started");
      return letterhead.promise;
    });

    await flush();
    expect(events).toEqual(["extraction started"]);

    extraction.resolve("text");
    await expect(first).resolves.toBe("text");
    await flush();
    expect(events).toEqual(["extraction started", "letterhead started"]);

    letterhead.resolve("grid");
    await expect(second).resolves.toBe("grid");
  });

  it("hands a failure to its own caller and lets the next task run", async () => {
    const gate = createWorkerGate();
    const crashed = deferred<string>();

    const first = gate(() => crashed.promise);
    const second = gate(async () => "ran");
    const third = gate(() => {
      throw new Error("threw before returning a promise");
    });
    const fourth = gate(async () => "ran too");

    crashed.reject(new Error("worker crashed"));
    await expect(first).rejects.toThrow("worker crashed");
    await expect(second).resolves.toBe("ran");
    await expect(third).rejects.toThrow("threw before returning a promise");
    await expect(fourth).resolves.toBe("ran too");
  });

  it("keeps separate gates independent", async () => {
    const held = deferred<void>();
    const one = createWorkerGate();
    const other = createWorkerGate();

    void one(() => held.promise);
    await expect(other(async () => "free")).resolves.toBe("free");
    held.resolve();
  });
});
