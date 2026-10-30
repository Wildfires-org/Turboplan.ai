import assert from "node:assert";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { resetEnvCache } from "@wildfires-org/turboplan-env";

import {
  getObjectBytes,
  resetR2Client,
  uploadFile,
} from "../src/server/r2-client";

// `getObjectBytes` against a mocked S3 client: the GetObject request, the
// key check, the size cap (declared and streamed), the content type, a
// missing object and the timeout. Bodies are web streams (what the Workers
// fetch handler gives) or SDK-style bodies that convert
// (`transformToWebStream`, the Node handler). The last suite keeps the real
// client and stubs only its Node HTTP handler, so the SDK's own response
// deserialising and stream mixin run.

const KEY = "letterheads/project/doc/logo-0-abc.png";
const LIMITS = { maxBytes: 16, timeoutMs: 1000 };

before(() => {
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_PUBLIC_URL = "https://files.example.test";
  resetEnvCache();
  resetR2Client();
});

type SentCommand = { input: Record<string, unknown> };
type SendOptions = { abortSignal?: AbortSignal } | undefined;

const streamOf = (...chunks: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new Uint8Array(chunk));
      }
      controller.close();
    },
  });

const mockGetObject = (
  respond: (command: SentCommand, options: SendOptions) => unknown,
) => {
  const sent: { command: SentCommand; options: SendOptions }[] = [];
  mock.method(
    S3Client.prototype,
    "send",
    async (command: SentCommand, options: SendOptions) => {
      assert.ok(command instanceof GetObjectCommand, "only GetObject is sent");
      sent.push({ command, options });
      return respond(command, options);
    },
  );
  return sent;
};

let warn: ReturnType<typeof mock.method>;
const reasons = () =>
  warn.mock.calls.map(
    (call) => (call.arguments[1] as { reason: string } | undefined)?.reason,
  );

beforeEach(() => {
  warn = mock.method(console, "warn", () => {});
});

afterEach(() => {
  mock.restoreAll();
});

describe("getObjectBytes", () => {
  it("reads the object by key from the bucket, with an abort signal", async () => {
    const sent = mockGetObject(() => ({
      Body: streamOf([1, 2], [3]),
      ContentLength: 3,
      ContentType: "Image/PNG; charset=binary",
    }));

    const object = await getObjectBytes(KEY, LIMITS);

    assert.deepStrictEqual(object, {
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    assert.deepStrictEqual(sent[0]?.command.input, {
      Bucket: "test-bucket",
      Key: KEY,
    });
    assert.ok(sent[0]?.options?.abortSignal instanceof AbortSignal);
  });

  it("reads a Node-style body through the SDK's stream mixin", async () => {
    mockGetObject(() => ({
      Body: { transformToWebStream: () => streamOf([7, 8]) },
      ContentType: "image/jpeg",
    }));

    const object = await getObjectBytes(KEY, LIMITS);

    assert.deepStrictEqual(object?.data, new Uint8Array([7, 8]));
    assert.strictEqual(object?.contentType, "image/jpeg");
  });

  it("returns the stored content type as is, and '' without one", async () => {
    mockGetObject(() => ({ Body: streamOf([1]), ContentType: "text/html" }));
    assert.strictEqual(
      (await getObjectBytes(KEY, LIMITS))?.contentType,
      "text/html",
    );

    mock.restoreAll();
    mockGetObject(() => ({ Body: streamOf([1]) }));
    assert.strictEqual((await getObjectBytes(KEY, LIMITS))?.contentType, "");
  });

  it("refuses an object whose declared length is over the cap, unread", async () => {
    let cancelled = false;
    mockGetObject(() => ({
      Body: new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      ContentLength: LIMITS.maxBytes + 1,
      ContentType: "image/png",
    }));

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["too_large"]);
    // Cancelled: the connection is not left half-read.
    assert.strictEqual(cancelled, true);
  });

  it("stops reading once the streamed bytes pass the cap, whatever was declared", async () => {
    mockGetObject(() => ({
      Body: streamOf(new Array(10).fill(0), new Array(10).fill(0)),
      ContentLength: 3,
      ContentType: "image/png",
    }));

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["too_large"]);
  });

  it("accepts an object of exactly the cap", async () => {
    mockGetObject(() => ({
      Body: streamOf(new Array(LIMITS.maxBytes).fill(1)),
      ContentType: "image/png",
    }));

    assert.strictEqual(
      (await getObjectBytes(KEY, LIMITS))?.data.byteLength,
      LIMITS.maxBytes,
    );
  });

  it("is null, never throwing, for a missing object", async () => {
    mockGetObject(() => {
      throw Object.assign(new Error("The specified key does not exist."), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      });
    });

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["not_found"]);
  });

  it("is null for any other failure, logging only the error's name", async () => {
    mockGetObject(() => {
      throw Object.assign(new Error(`AccessDenied for ${KEY}`), {
        name: "AccessDenied",
      });
    });

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["AccessDenied"]);
    assert.strictEqual(JSON.stringify(warn.mock.calls).includes(KEY), false);
  });

  it("is null for a response without a readable body", async () => {
    mockGetObject(() => ({ ContentType: "image/png" }));

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["no_body"]);
  });

  it("gives up on a request that does not answer in time, aborting it", async () => {
    let signal: AbortSignal | undefined;
    mockGetObject(
      (_command, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.abortSignal;
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );

    const startedAt = Date.now();
    assert.strictEqual(
      await getObjectBytes(KEY, { maxBytes: 16, timeoutMs: 20 }),
      null,
    );
    assert.ok(Date.now() - startedAt < 1000);
    assert.strictEqual(signal?.aborted, true);
    assert.deepStrictEqual(reasons(), ["timeout"]);
  });

  it("gives up on a body that stalls, cancelling it", async () => {
    let cancelled = false;
    mockGetObject(() => ({
      Body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          // Never closes.
        },
        cancel() {
          cancelled = true;
        },
      }),
      ContentType: "image/png",
    }));

    assert.strictEqual(
      await getObjectBytes(KEY, { maxBytes: 16, timeoutMs: 20 }),
      null,
    );
    assert.strictEqual(cancelled, true);
    assert.deepStrictEqual(reasons(), ["timeout"]);
  });

  it("sends nothing for a key that does not name one object of the bucket", async () => {
    const sent = mockGetObject(() => ({ Body: streamOf([1]) }));
    const unsafeKeys = [
      "",
      // Resolved by the HTTP layer into another path of the account.
      "../other-bucket/x.png",
      "letterheads/../../other-bucket/x.png",
      "letterheads/./x.png",
      "/letterheads/x.png",
      "letterheads//x.png",
      "letterheads/x.png/",
      "letterheads\\x.png",
      "letterheads/x\u0000.png",
      "letterheads/x\u0085.png",
      "letterheads/x\ud800.png",
      `letterheads/${"a".repeat(1025)}`,
    ];

    for (const key of unsafeKeys) {
      assert.strictEqual(await getObjectBytes(key, LIMITS), null, key);
    }

    assert.strictEqual(sent.length, 0);
    assert.deepStrictEqual(
      reasons(),
      unsafeKeys.map(() => "invalid_key"),
    );
    assert.strictEqual(
      JSON.stringify(warn.mock.calls).includes("other-bucket"),
      false,
    );
  });

  it("cancels a response that arrives after the timeout, never reading it", async () => {
    let pulls = 0;
    let markCancelled: () => void = () => {};
    const cancelled = new Promise<void>((resolve) => {
      markCancelled = resolve;
    });
    mockGetObject(
      (_command, options) =>
        // A handler that ignores the abort and answers anyway, late.
        new Promise((resolve) => {
          options?.abortSignal?.addEventListener("abort", () =>
            setTimeout(
              () =>
                resolve({
                  Body: new ReadableStream<Uint8Array>(
                    {
                      pull(controller) {
                        pulls += 1;
                        controller.enqueue(new Uint8Array([1]));
                      },
                      cancel() {
                        markCancelled();
                      },
                    },
                    // Nothing is pulled until someone reads.
                    { highWaterMark: 0 },
                  ),
                  ContentType: "image/png",
                }),
              5,
            ),
          );
        }),
    );

    assert.strictEqual(
      await getObjectBytes(KEY, { maxBytes: 16, timeoutMs: 20 }),
      null,
    );
    assert.deepStrictEqual(reasons(), ["timeout"]);

    await Promise.race([
      cancelled,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("body never cancelled")), 1000),
      ),
    ]);
    assert.strictEqual(pulls, 0);
  });

  it("reads by key without R2_PUBLIC_URL: the credentials are enough", async () => {
    const saved = process.env.R2_PUBLIC_URL;
    delete process.env.R2_PUBLIC_URL;
    resetEnvCache();
    resetR2Client();
    try {
      const sent = mockGetObject(() => ({
        Body: streamOf([5]),
        ContentType: "image/png",
      }));

      assert.deepStrictEqual(await getObjectBytes(KEY, LIMITS), {
        data: new Uint8Array([5]),
        contentType: "image/png",
      });
      assert.strictEqual(sent[0]?.command.input.Bucket, "test-bucket");
    } finally {
      process.env.R2_PUBLIC_URL = saved;
      resetEnvCache();
      resetR2Client();
    }
  });

  it("is null, never throwing, without R2 credentials", async () => {
    const saved = process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    resetEnvCache();
    resetR2Client();
    try {
      assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    } finally {
      process.env.R2_ACCESS_KEY_ID = saved;
      resetEnvCache();
      resetR2Client();
    }
  });
});

describe("uploadFile without R2_PUBLIC_URL", () => {
  it("writes nothing, since no URL could name the object", async () => {
    const saved = process.env.R2_PUBLIC_URL;
    delete process.env.R2_PUBLIC_URL;
    resetEnvCache();
    resetR2Client();
    const send = mock.method(S3Client.prototype, "send", async () => ({}));
    try {
      await assert.rejects(
        uploadFile(KEY, new Uint8Array([1]), "image/png"),
        /R2_PUBLIC_URL/,
      );
      assert.strictEqual(send.mock.callCount(), 0);
    } finally {
      process.env.R2_PUBLIC_URL = saved;
      resetEnvCache();
      resetR2Client();
    }
  });
});

// The real S3 client, with only the Node HTTP handler's `handle` stubbed: the
// SDK signs the request, deserialises the response and wraps its Node body
// in the stream mixin, exactly as in production on Node. The handler and
// HttpResponse are loaded from the SDK's own dependencies (not ours), so the
// patched prototype is the one the client uses.
type HttpRequest = { method: string; hostname: string; path: string };
type HandlerOptions = { abortSignal?: AbortSignal } | undefined;

const requireFromSdk = createRequire(import.meta.resolve("@aws-sdk/client-s3"));
const { NodeHttpHandler } = requireFromSdk("@smithy/node-http-handler") as {
  NodeHttpHandler: {
    prototype: {
      handle: (
        request: HttpRequest,
        options: HandlerOptions,
      ) => Promise<{ response: unknown }>;
    };
  };
};
const { HttpResponse } = createRequire(
  requireFromSdk.resolve("@smithy/node-http-handler"),
)("@smithy/protocol-http") as {
  HttpResponse: new (options: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  }) => unknown;
};

const stubHttpHandler = (
  respond: (request: HttpRequest, options: HandlerOptions) => unknown,
) => {
  const requests: { request: HttpRequest; options: HandlerOptions }[] = [];
  mock.method(
    NodeHttpHandler.prototype,
    "handle",
    async (request: HttpRequest, options: HandlerOptions) => {
      requests.push({ request, options });
      return { response: await respond(request, options) };
    },
  );
  return requests;
};

// A body as the Node handler gives it (an IncomingMessage pushes what
// arrives), ended unless `open`. The cancel cases use this rather than
// `Readable.from`: Node's `Readable.toWeb` adapter throws an uncaught
// "Controller is already closed" when a cancelled stream is iterator-based.
const httpBody = (chunks: number[][], { open = false } = {}) => {
  const body = new Readable({ read() {} });
  for (const chunk of chunks) {
    body.push(Buffer.from(chunk));
  }
  if (!open) {
    body.push(null);
  }
  return body;
};

const okResponse = (body: Readable, headers: Record<string, string> = {}) =>
  new HttpResponse({
    statusCode: 200,
    headers: { "content-type": "image/png", ...headers },
    body,
  });

describe("getObjectBytes through the SDK's Node body path", () => {
  it("reads the deserialised body through transformToWebStream", async () => {
    const requests = stubHttpHandler(() =>
      okResponse(Readable.from([Buffer.from([1, 2]), Buffer.from([3])]), {
        "content-length": "3",
        "content-type": "Image/PNG",
      }),
    );

    assert.deepStrictEqual(await getObjectBytes(KEY, LIMITS), {
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0]?.request.method, "GET");
    assert.strictEqual(
      requests[0]?.request.hostname,
      "test-bucket.test-account.r2.cloudflarestorage.com",
    );
    assert.strictEqual(requests[0]?.request.path, `/${KEY}`);
    assert.ok(requests[0]?.options?.abortSignal instanceof AbortSignal);
  });

  it("never sends a request for a key outside the bucket", async () => {
    const requests = stubHttpHandler(() => okResponse(Readable.from([])));

    assert.strictEqual(
      await getObjectBytes("../other-bucket/x.png", LIMITS),
      null,
    );
    assert.strictEqual(requests.length, 0);
    assert.deepStrictEqual(reasons(), ["invalid_key"]);
  });

  it("refuses a declared length over the cap, destroying the Node body", async () => {
    const body = httpBody([new Array(LIMITS.maxBytes + 1).fill(0)]);
    stubHttpHandler(() =>
      okResponse(body, { "content-length": String(LIMITS.maxBytes + 1) }),
    );

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["too_large"]);
    assert.strictEqual(body.destroyed, true);
  });

  it("stops at the cap when the body is longer than declared", async () => {
    const chunk = new Array(10).fill(0);
    // Still open after 30 bytes: only the cap ends the read.
    const body = httpBody([chunk, chunk, chunk], { open: true });
    stubHttpHandler(() => okResponse(body, { "content-length": "3" }));

    assert.strictEqual(await getObjectBytes(KEY, LIMITS), null);
    assert.deepStrictEqual(reasons(), ["too_large"]);
    assert.strictEqual(body.destroyed, true);
  });

  it("gives up on a Node body that stalls, destroying it", async () => {
    const body = httpBody([[1]], { open: true });
    stubHttpHandler(() => okResponse(body));

    assert.strictEqual(
      await getObjectBytes(KEY, { maxBytes: 16, timeoutMs: 20 }),
      null,
    );
    assert.deepStrictEqual(reasons(), ["timeout"]);
    assert.strictEqual(body.destroyed, true);
  });

  it("aborts a request that does not answer in time", async () => {
    let signal: AbortSignal | undefined;
    stubHttpHandler(
      (_request, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.abortSignal;
          signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );

    assert.strictEqual(
      await getObjectBytes(KEY, { maxBytes: 16, timeoutMs: 20 }),
      null,
    );
    assert.strictEqual(signal?.aborted, true);
    assert.deepStrictEqual(reasons(), ["timeout"]);
  });
});
