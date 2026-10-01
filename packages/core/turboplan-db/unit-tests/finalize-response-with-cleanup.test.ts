import assert from "node:assert";
import { describe, it } from "node:test";

import {
  finalizeResponseWithCleanup,
  registerBackgroundTask,
  runWithWorkerConnectionForResponse,
} from "../src/db-client/connection";

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

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((resolveArg) => {
    resolve = resolveArg;
  });
  return { promise, resolve };
};

// Lets queued microtasks and short timers run.
const tick = (ms = 20) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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

  it("waits for background tasks after the client cancels", async () => {
    const harness = makeHarness();
    const task = deferred();
    const backgroundTasks: Promise<unknown>[] = [];
    const response = new Response(streamOf(["alpha", "beta"]));

    const result = finalizeResponseWithCleanup(response, {
      waitUntil: harness.waitUntil,
      cleanup: harness.cleanup,
      graceMs: 0,
      backgroundTasks,
    });

    // Registered after the response was handed back, like a tee drain.
    backgroundTasks.push(task.promise);
    await (result.body as ReadableStream<Uint8Array>).cancel();
    await tick();
    assert.strictEqual(harness.getCleanupCalls(), 0);

    task.resolve();
    await Promise.all(harness.waited);
    assert.strictEqual(harness.getCleanupCalls(), 1);
  });

  it("cleans up even when a background task rejects", async () => {
    const harness = makeHarness();
    const response = new Response(null, { status: 204 });

    finalizeResponseWithCleanup(response, {
      waitUntil: harness.waitUntil,
      cleanup: harness.cleanup,
      backgroundTasks: [Promise.reject(new Error("boom"))],
    });

    await Promise.all(harness.waited);
    assert.strictEqual(harness.getCleanupCalls(), 1);
  });
});

describe("registerBackgroundTask", () => {
  it("is a no-op outside a request-scoped connection", () => {
    assert.doesNotThrow(() => {
      registerBackgroundTask(Promise.resolve());
    });
  });

  it("keeps the request's waitUntil pending until registered work settles", async () => {
    const waited: Promise<unknown>[] = [];
    const task = deferred();
    let isDone = false;

    // postgres.js connects lazily, so no database is needed: nothing queries.
    const response = await runWithWorkerConnectionForResponse(
      async () => {
        registerBackgroundTask(task.promise);
        return new Response(streamOf(["alpha"]));
      },
      {
        waitUntil: (promise) => {
          waited.push(promise);
        },
        connectionString: "postgres://user:pass@127.0.0.1:1/unused",
        graceMs: 0,
      },
    );

    const done = Promise.all(waited).then(() => {
      isDone = true;
    });

    await (response.body as ReadableStream<Uint8Array>).cancel();
    await tick();
    assert.strictEqual(isDone, false);

    task.resolve();
    await done;
    assert.strictEqual(isDone, true);
  });
});
