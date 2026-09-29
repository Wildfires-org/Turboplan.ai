import assert from "node:assert";
import { describe, it } from "node:test";

import { finalizeResponseWithCleanup } from "../src/db-client/connection";

const makeHarness = () => {
  const waited: Promise<unknown>[] = [];
  let cleanupCalls = 0;

  return {
    waited,
    getCleanupCalls: () => cleanupCalls,
    waitUntil: (promise: Promise<unknown>) => {
      waited.push(promise);
    },
    cleanup: async () => {
      cleanupCalls += 1;
    },
  };
};

const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull: (controller) => {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
};

describe("finalizeResponseWithCleanup", () => {
  it("cleans up immediately for a body-less response", async () => {
    const harness = makeHarness();
    const response = new Response(null, { status: 204 });

    const result = finalizeResponseWithCleanup(response, {
      waitUntil: harness.waitUntil,
      cleanup: harness.cleanup,
    });

    assert.strictEqual(result, response);
    assert.strictEqual(harness.waited.length, 1);

    await Promise.all(harness.waited);
    assert.strictEqual(harness.getCleanupCalls(), 1);
  });

  it("holds the connection until the streamed body is drained", async () => {
    const harness = makeHarness();
    const response = new Response(streamOf(["alpha", "beta", "gamma"]), {
      status: 200,
      headers: { "content-type": "text/plain", "x-custom": "kept" },
    });

    const result = finalizeResponseWithCleanup(response, {
      waitUntil: harness.waitUntil,
      cleanup: harness.cleanup,
      graceMs: 10,
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.headers.get("x-custom"), "kept");

    const reader = (result.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let body = "";

    const first = await reader.read();
    body += decoder.decode(first.value);
    assert.strictEqual(harness.getCleanupCalls(), 0);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      body += decoder.decode(value);
    }

    await Promise.all(harness.waited);

    assert.strictEqual(body, "alphabetagamma");
    assert.strictEqual(harness.getCleanupCalls(), 1);
  });

  it("cleans up when the consumer cancels the stream early", async () => {
    const harness = makeHarness();
    const response = new Response(streamOf(["alpha", "beta", "gamma"]));

    const result = finalizeResponseWithCleanup(response, {
      waitUntil: harness.waitUntil,
      cleanup: harness.cleanup,
      graceMs: 10,
    });

    await (result.body as ReadableStream<Uint8Array>).cancel();
    await Promise.all(harness.waited);

    assert.strictEqual(harness.getCleanupCalls(), 1);
  });
});
