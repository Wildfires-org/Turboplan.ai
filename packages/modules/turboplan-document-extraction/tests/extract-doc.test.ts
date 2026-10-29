import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Worker } from "node:worker_threads";

import { DOC_MIME, DOCX_MIME, PDF_MIME } from "../src/document-mime";
import { getGenericExtractionError } from "../src/errors";
import { extractDocumentText, MAX_EXTRACTED_CHARS } from "../src/extract-text";

// Word 97-2003 file generated with macOS `textutil -convert doc` from a short
// plain-text memo (19 KB, no author metadata).
const SAMPLE_DOC_URL = new URL("./fixtures/sample.doc", import.meta.url);
const sampleDoc = readFileSync(SAMPLE_DOC_URL);

const DOCUMENT_URL = "https://storage.example.com/uploads/memo.doc";

const RESAVE_HINT = "Re-save it as .docx or PDF and upload it again.";

// The fixture stores its body as UTF-16; this is where "Sample Scoping Memo"
// starts.
const BODY_OFFSET = sampleDoc.indexOf(
  Buffer.from("Sample Scoping Memo", "utf16le"),
);

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
      message: `Not a valid Word 97-2003 (.doc) file. ${RESAVE_HINT}`,
    });
  });

  for (const [format, bytes, expected] of [
    ["RTF", "{\\rtf1\\ansi\\deff0 {\\fonttbl}Hello}", "Rich Text (RTF)"],
    [
      "HTML",
      "\ufeff  <!DOCTYPE html><html><body>Hi</body></html>",
      "web page (HTML)",
    ],
    [
      "MHTML",
      'MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="x"\r\n',
      "web page (HTML)",
    ],
    [
      "Word 2003 XML",
      '<?xml version="1.0"?><?mso-application progid="Word.Document"?><w:wordDocument>',
      "Word XML document",
    ],
    ["other XML", '<?xml version="1.0"?><report/>', "an XML document"],
  ] as const) {
    it(`names ${format} saved under a .doc extension`, async () => {
      serveBytes(Buffer.from(bytes, "utf8"));

      const result = await extractDocumentText({
        url: DOCUMENT_URL,
        mimeType: DOC_MIME,
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.reason, "extraction-failed");
        assert.ok(result.message?.includes(expected), result.message);
        assert.ok(result.message?.endsWith(RESAVE_HINT), result.message);
      }
    });
  }

  it("fails (not throws) on a truncated compound file, without raw errors", async () => {
    serveBytes(sampleDoc.subarray(0, 1024));

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.reason, "extraction-failed");
      assert.strictEqual(
        result.message,
        `Could not read the .doc file. It may be damaged or password-protected. ${RESAVE_HINT}`,
      );
      // The library's own error is kept for the logs only.
      assert.ok(result.detail);
      assert.ok(!result.message?.includes(result.detail));
    }
  });

  it("strips field codes before word-extractor cleans the text", async () => {
    // An unmatched field start in place of the body's first letter. The
    // library alone keeps the raw \x13; the guard drops it.
    const tampered = Buffer.from(sampleDoc);
    tampered.write("\x13", BODY_OFFSET, "utf16le");
    serveBytes(tampered);

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOC_MIME,
    });

    assert.ok(result.ok, JSON.stringify(result));
    assert.ok(result.text.startsWith("ample Scoping Memo"), result.text);
  });

  it("maps raw parser errors on .docx to a generic message", async () => {
    // A well-formed empty zip: passes the prescan, then mammoth throws.
    serveBytes(
      Buffer.from([
        0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ]),
    );

    const result = await extractDocumentText({
      url: DOCUMENT_URL,
      mimeType: DOCX_MIME,
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.message, getGenericExtractionError(DOCX_MIME));
      assert.ok(result.message?.includes(".docx or PDF"));
      assert.ok(result.detail);
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

describe("extractDocumentText — failure wording", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not tell users to re-save a broken PDF as PDF", async () => {
    serveBytes(Buffer.from("%PDF-1.7 truncated garbage"));

    const result = await extractDocumentText({
      url: "https://storage.example.com/uploads/report.pdf",
      mimeType: PDF_MIME,
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.message, getGenericExtractionError(PDF_MIME));
      assert.ok(result.message?.includes("new PDF"));
      assert.ok(result.detail);
    }
  });
});

describe("extractDocumentText — .doc without the field-code guard", () => {
  const require = createRequire(import.meta.url);
  const { prototype } = require("word-extractor/lib/word-ole-extractor.js");
  const guardMark = Symbol.for("turboplan.wordFieldCodeGuard");

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fails closed with a message that blames the server, not the file", async () => {
    const savedBuildDocument = prototype.buildDocument;
    const savedMark = prototype[guardMark];
    // What an upgrade that renamed the hooked method would look like.
    delete prototype[guardMark];
    prototype.buildDocument = undefined;
    serveBytes(sampleDoc);

    try {
      const result = await extractDocumentText({
        url: DOCUMENT_URL,
        mimeType: DOC_MIME,
      });

      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.ok(result.message?.includes("problem on our side"));
        assert.ok(!result.message?.includes("damaged"));
        assert.ok(result.detail?.includes("field-code guard unavailable"));
      }
    } finally {
      prototype.buildDocument = savedBuildDocument;
      prototype[guardMark] = savedMark;
    }
  });
});
