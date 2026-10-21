import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

// The one letterhead image guard (`readLetterheadImage`): grid logos by
// object key through the bucket's credentials (`getObjectBytes`, stubbed),
// legacy logos by URL through the SSRF-guarded fetch of our storage. A key is
// never fetched over HTTP, a URL never read by key.

const STORAGE = "https://files.example.test";
const KEY = "letterheads/project/doc/logo-0-abc.png";
const UPLOAD_KEY = "uploads/3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d/1-logo.png";
const LEGACY_URL = `${STORAGE}/branding/office-logo.png`;

Object.assign(process.env, {
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_BUCKET_NAME: "test",
  R2_PUBLIC_URL: STORAGE,
});

type Stored = { data: Uint8Array; contentType: string } | null;
const reads: { key: string; options: unknown }[] = [];
let stored: Stored = null;
const actualUpload = await import("@wildfires-org/turboplan-upload/server");
mock.module("@wildfires-org/turboplan-upload/server", {
  namedExports: {
    ...actualUpload,
    getObjectBytes: async (key: string, options: unknown) => {
      reads.push({ key, options });
      return stored;
    },
  },
});

const { readLetterheadImage } = await import("../src/server/letterhead-image");

const PNG = { data: new Uint8Array([0x89, 0x50]), contentType: "image/png" };

const originalFetch = globalThis.fetch;
const fetched: { url: string; init?: RequestInit }[] = [];
let respond: () => Response = () =>
  new Response(new Uint8Array([1, 2]), {
    headers: { "content-type": "image/jpeg" },
  });
let warn: ReturnType<typeof mock.method>;

beforeEach(() => {
  reads.length = 0;
  fetched.length = 0;
  stored = PNG;
  respond = () =>
    new Response(new Uint8Array([1, 2]), {
      headers: { "content-type": "image/jpeg" },
    });
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    fetched.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
  warn = mock.method(console, "warn", () => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  warn.mock.restore();
});

describe("readLetterheadImage by key", () => {
  it("reads a grid logo with the bucket's credentials, bounded, never over HTTP", async () => {
    for (const key of [KEY, UPLOAD_KEY]) {
      assert.deepEqual(await readLetterheadImage({ key }), PNG);
    }

    assert.deepEqual(reads, [
      { key: KEY, options: { maxBytes: 5 * 1024 * 1024, timeoutMs: 5000 } },
      {
        key: UPLOAD_KEY,
        options: { maxBytes: 5 * 1024 * 1024, timeoutMs: 5000 },
      },
    ]);
    assert.deepEqual(fetched, []);
  });

  it("accepts PNG and JPEG only", async () => {
    stored = { data: new Uint8Array([1]), contentType: "image/jpeg" };
    assert.deepEqual(await readLetterheadImage({ key: KEY }), stored);

    for (const contentType of [
      "image/svg+xml",
      "text/html",
      "image/webp",
      "",
    ]) {
      stored = { data: new Uint8Array([1]), contentType };
      assert.equal(await readLetterheadImage({ key: KEY }), null, contentType);
    }
  });

  it("is null when the object cannot be read", async () => {
    stored = null;

    assert.equal(await readLetterheadImage({ key: KEY }), null);
  });

  it("never reads a key that is not a letterhead logo key", async () => {
    for (const key of [
      "",
      "org-logos/0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e.png",
      "landing-uploads/1730000000000-x.pdf",
      "/letterheads/project/doc/logo.png",
      "letterheads/../uploads/other/logo.png",
      `${STORAGE}/${KEY}`,
    ]) {
      assert.equal(await readLetterheadImage({ key }), null, key);
    }

    assert.deepEqual(reads, []);
    assert.deepEqual(fetched, []);
  });
});

describe("readLetterheadImage by URL", () => {
  it("fetches a legacy logo from our storage, never following a redirect", async () => {
    const logo = await readLetterheadImage({ url: LEGACY_URL });

    assert.deepEqual(logo, {
      data: new Uint8Array([1, 2]),
      contentType: "image/jpeg",
    });
    assert.deepEqual(
      fetched.map(({ url }) => url),
      [LEGACY_URL],
    );
    assert.equal(fetched[0]?.init?.redirect, "manual");
    assert.ok(fetched[0]?.init?.signal instanceof AbortSignal);
    assert.deepEqual(reads, []);
  });

  it("never fetches a URL outside our storage, nor reads it by key", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/logo.png",
      "https://cdn.example.gov/seal.png",
      `${STORAGE}.evil.test/${KEY}`,
      `${STORAGE}/letterheads//logo.png`,
      KEY,
    ]) {
      assert.equal(await readLetterheadImage({ url }), null, url);
    }

    assert.deepEqual(fetched, []);
    assert.deepEqual(reads, []);
  });

  it("is null without a URL, for a redirect, an error status, another type or too many bytes", async () => {
    assert.equal(await readLetterheadImage({ url: null }), null);
    assert.deepEqual(fetched, []);

    for (const response of [
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/x.png" },
        }),
      () => new Response("boom", { status: 500 }),
      () =>
        new Response("<svg/>", {
          headers: { "content-type": "image/svg+xml" },
        }),
      () =>
        new Response(new Uint8Array(1), {
          headers: {
            "content-type": "image/png",
            "content-length": String(5 * 1024 * 1024 + 1),
          },
        }),
      () =>
        new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
          headers: { "content-type": "image/png" },
        }),
    ]) {
      respond = response;
      assert.equal(await readLetterheadImage({ url: LEGACY_URL }), null);
    }
    assert.deepEqual(reads, []);
  });

  it("stops reading a body that runs past 5 MB, whatever it declared", async () => {
    let pulls = 0;
    let cancelled = false;
    // Endless 1 MB chunks, no content-length: only the cap ends the read.
    respond = () =>
      new Response(
        new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls += 1;
              controller.enqueue(new Uint8Array(1024 * 1024));
            },
            cancel() {
              cancelled = true;
            },
          },
          { highWaterMark: 0 },
        ),
        { headers: { "content-type": "image/png" } },
      );

    assert.equal(await readLetterheadImage({ url: LEGACY_URL }), null);
    assert.equal(cancelled, true);
    // The sixth megabyte crossed the cap; nothing after it was read.
    assert.equal(pulls, 6);
  });

  it("is null, never throwing, when the fetch fails", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;

    assert.equal(await readLetterheadImage({ url: LEGACY_URL }), null);
  });
});
