import assert from "node:assert";
import { describe, it } from "node:test";

import { readCapped } from "../src/server/read-capped";

// A pull-based stream of `chunks` (then closed unless `open`), counting how
// many chunks were pulled and whether it was cancelled.
const source = (chunks: number[][], { open = false } = {}) => {
  const state = { pulls: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[state.pulls];
        state.pulls += 1;
        if (chunk) {
          controller.enqueue(new Uint8Array(chunk));
        } else if (!open) {
          controller.close();
        }
      },
      cancel() {
        state.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, state };
};

describe("readCapped", () => {
  it("reads the whole stream into one array", async () => {
    const { stream } = source([[1, 2], [3], [4, 5]]);

    assert.deepStrictEqual(
      await readCapped(stream, 5),
      new Uint8Array([1, 2, 3, 4, 5]),
    );
  });

  it("reads an empty stream as no bytes", async () => {
    const { stream } = source([]);

    assert.deepStrictEqual(await readCapped(stream, 5), new Uint8Array());
  });

  it("stops once the counted bytes pass the cap, cancelling the stream", async () => {
    const chunk = new Array(4).fill(0);
    const { stream, state } = source([chunk, chunk, chunk, chunk, chunk]);

    assert.strictEqual(await readCapped(stream, 6), "too_large");
    assert.strictEqual(state.cancelled, true);
    // The chunk that crossed the cap is the last one pulled.
    assert.strictEqual(state.pulls, 2);
  });

  it("gives up once the signal aborts, cancelling a stalled stream", async () => {
    const { stream, state } = source([[1]], { open: true });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    assert.strictEqual(
      await readCapped(stream, 16, controller.signal),
      "timeout",
    );
    assert.strictEqual(state.cancelled, true);
  });

  it("reads nothing when the signal has already aborted", async () => {
    const { stream, state } = source([[1]]);

    assert.strictEqual(
      await readCapped(stream, 16, AbortSignal.abort()),
      "timeout",
    );
    assert.strictEqual(state.pulls, 0);
    assert.strictEqual(state.cancelled, true);
  });

  it("rejects with the stream's own error", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new TypeError("connection reset"));
      },
    });

    await assert.rejects(readCapped(stream, 16), {
      name: "TypeError",
      message: "connection reset",
    });
  });
});
