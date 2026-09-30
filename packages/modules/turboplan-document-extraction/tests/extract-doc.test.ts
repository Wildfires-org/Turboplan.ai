import assert from "node:assert";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Worker } from "node:worker_threads";

import { DOC_MIME, DOCX_MIME } from "../src/document-mime";
import { extractDocumentText, MAX_EXTRACTED_CHARS } from "../src/extract-text";

// Word 97-2003 file generated with macOS `textutil -convert doc` from a short
// plain-text memo (19 KB, no author metadata).
const SAMPLE_DOC_URL = new URL("./fixtures/sample.doc", import.meta.url);
const sampleDoc = readFileSync(SAMPLE_DOC_URL);

const DOCUMENT_URL = "https://storage.example.com/uploads/memo.doc";

const originalFetch = globalThis.fetch;

const serveBytes = (bytes: Buffer | Uint8Array) => {
  globalThis.fetch = (async () =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "content-length": String(bytes.byteLength) },
    })) as typeof fetch;
};

describe("extractDocumentText — legacy .doc", () => {
  beforeEach(() => {
    serveBytes(sampleDoc);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the body text of a Word 97-2003 file", async () => {
    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.ok(result.ok, JSON.stringify(result));
    assert.strictEqual(result.truncated, false);
    assert.ok(result.text.startsWith("Sample Scoping Memo"));
    assert.ok(
      result.text.includes(
        "The proposed trail realignment crosses two seasonal creeks.",
      ),
    );
    assert.ok(result.text.length <= MAX_EXTRACTED_CHARS);
  });

  it("accepts the MIME type in any case", async () => {
    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: "Application/MSWord",
    });

    assert.ok(result.ok);
  });

  it("fails with a readable error for bytes that are not a .doc", async () => {
    serveBytes(Buffer.from("%PDF-1.7 definitely not a Word file"));

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "extraction-failed",
      message: "Not a valid Word 97-2003 (.doc) file",
    });
  });

  it("fails (not throws) on a truncated compound file", async () => {
    serveBytes(sampleDoc.subarray(0, 1024));

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.reason, "extraction-failed");
      assert.ok(result.message?.startsWith("Could not read the .doc file"));
    }
  });

  it("routes a .docx saved under a .doc label through the .docx path", async () => {
    // A bare zip header without a central directory: the .docx prescan must
    // be the one rejecting it.
    serveBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]));

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "extraction-failed",
      message: "Not a valid .docx archive",
    });
  });

  it("still reports other types as unsupported", async () => {
    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: "application/vnd.ms-excel",
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.reason, "unsupported-format");
    }
  });

  it("leaves .docx handling unchanged", async () => {
    serveBytes(Buffer.from("not a zip"));

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOCX_MIME,
    });

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "extraction-failed",
      message: "Not a valid .docx archive",
    });
  });
});

describe("word-extractor in a worker thread", () => {
  it("parses the fixture off the main thread", async () => {
    const worker = new Worker(
      new URL("./fixtures/doc-worker.mjs", import.meta.url),
      {
        workerData: sampleDoc,
        resourceLimits: { maxOldGenerationSizeMb: 64 },
      },
    );

    const body = await new Promise<string>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    await worker.terminate();

    assert.ok(body.includes("Mitigation: install culverts"));
  });
});
