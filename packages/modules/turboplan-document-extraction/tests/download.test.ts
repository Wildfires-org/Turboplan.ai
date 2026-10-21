import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

import { downloadDocument } from "../src/download";

const originalFetch = globalThis.fetch;

describe("downloadDocument", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const failIfFetched = () => {
    globalThis.fetch = (async () => {
      throw new Error("fetch must not be called");
    }) as typeof fetch;
  };

  for (const url of [
    "http://storage.example.com/a.pdf",
    "https://127.0.0.1/a.pdf",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/a.pdf",
    "https://metadata/a.pdf",
  ]) {
    it(`rejects ${url} without opening a connection`, async () => {
      failIfFetched();

      const result = await downloadDocument(url);

      assert.deepStrictEqual(result, {
        ok: false,
        reason: "fetch-failed",
        message: "Disallowed document URL",
      });
    });
  }

  it("rejects a redirect to an internal address", async () => {
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://10.0.0.5/a.pdf" },
      })) as typeof fetch;

    const result = await downloadDocument("https://storage.example.com/a.pdf");

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "fetch-failed",
      message: "Disallowed redirect URL",
    });
  });

  it("returns the body of an allowed URL", async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as typeof fetch;

    const result = await downloadDocument("https://storage.example.com/a.pdf");

    assert.ok(result.ok);
    assert.deepStrictEqual([...result.buffer], [1, 2, 3]);
  });
});
