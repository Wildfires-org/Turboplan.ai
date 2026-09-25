import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSafeDocumentFilename,
  readBodyWithLimit,
  resolveDocumentMimeType,
} from "../src/server/document-utils";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7");
const HTML_BYTES = new TextEncoder().encode("<html>");

describe("resolveDocumentMimeType", () => {
  it("accepts allowlisted document types, ignoring parameters and case", () => {
    assert.equal(resolveDocumentMimeType(PDF, HTML_BYTES), PDF);
    assert.equal(
      resolveDocumentMimeType("Application/PDF; charset=binary", HTML_BYTES),
      PDF,
    );
    assert.equal(resolveDocumentMimeType(DOCX, HTML_BYTES), DOCX);
    assert.equal(
      resolveDocumentMimeType("application/msword", HTML_BYTES),
      "application/msword",
    );
  });

  it("rejects active content types", () => {
    for (const type of [
      "text/html",
      "image/svg+xml",
      "application/xhtml+xml",
      "text/javascript",
      "image/png",
    ]) {
      assert.equal(resolveDocumentMimeType(type, PDF_BYTES), null);
    }
  });

  it("accepts unlabelled bodies only when they are PDFs", () => {
    assert.equal(resolveDocumentMimeType(null, PDF_BYTES), PDF);
    assert.equal(
      resolveDocumentMimeType("application/octet-stream", PDF_BYTES),
      PDF,
    );
    assert.equal(resolveDocumentMimeType(null, HTML_BYTES), null);
    assert.equal(
      resolveDocumentMimeType("application/octet-stream", HTML_BYTES),
      null,
    );
  });

  it("does not treat prototype keys as allowlisted", () => {
    assert.equal(resolveDocumentMimeType("constructor", PDF_BYTES), null);
    assert.equal(resolveDocumentMimeType("__proto__", PDF_BYTES), null);
  });
});

describe("buildSafeDocumentFilename", () => {
  it("keeps a plain filename from the URL", () => {
    assert.equal(
      buildSafeDocumentFilename(
        "https://gov.example/docs/Plan%20Final.pdf",
        "Title",
        PDF,
      ),
      "Plan Final.pdf",
    );
  });

  it("cannot add key segments via encoded separators", () => {
    const name = buildSafeDocumentFilename(
      "https://gov.example/docs/..%2F..%2Fother%5Cx%2Fevil.pdf",
      "Title",
      PDF,
    );
    assert.ok(!name.includes("/"));
    assert.ok(!name.includes("\\"));
    assert.ok(!name.startsWith("."));
    assert.ok(name.endsWith(".pdf"));
  });

  it("strips control characters", () => {
    const name = buildSafeDocumentFilename(
      "https://gov.example/a%0D%0Ab%00c.pdf",
      "Title",
      PDF,
    );
    assert.equal(name, "a__b_c.pdf");
  });

  it("forces the extension to match the stored type", () => {
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/x.html", "T", PDF),
      "x.html.pdf",
    );
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/report", "T", DOCX),
      "report.docx",
    );
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/REPORT.PDF", "T", PDF),
      "REPORT.PDF",
    );
  });

  it("falls back to the title, then a default name", () => {
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/", "Plan/2024", PDF),
      "Plan_2024.pdf",
    );
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/", "", PDF),
      "document.pdf",
    );
  });

  it("survives malformed percent-encoding without keeping raw escapes", () => {
    assert.equal(
      buildSafeDocumentFilename(
        "https://gov.example/bad%E0%A4%A.pdf",
        "T",
        PDF,
      ),
      "bad_E0_A4_A.pdf",
    );
  });

  it("replaces characters that change URL meaning in the public key", () => {
    assert.equal(
      buildSafeDocumentFilename(
        "https://gov.example/a%3Fb%23c%2525d.pdf",
        "T",
        PDF,
      ),
      "a_b_c_25d.pdf",
    );
  });

  it("stores dot-dot segments as a harmless name", () => {
    const name = buildSafeDocumentFilename(
      "https://gov.example/docs/%2E%2E",
      "Title",
      PDF,
    );
    assert.equal(name, "Title.pdf");
  });

  it("uses the title for Box share links", () => {
    assert.equal(
      buildSafeDocumentFilename(
        "https://app.box.com/index.php?rm=box_download_shared_file&file_id=1",
        "Permit Plan",
        PDF,
      ),
      "Permit Plan.pdf",
    );
  });

  it("bounds the filename length", () => {
    const name = buildSafeDocumentFilename(
      `https://gov.example/${"a".repeat(500)}`,
      "T",
      PDF,
    );
    assert.ok(name.length <= 200);
    assert.ok(name.endsWith(".pdf"));
  });
});

const streamResponse = (
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
): { response: Response; wasCancelled: () => boolean } => {
  let cancelled = false;
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(body, { headers }),
    wasCancelled: () => cancelled,
  };
};

describe("readBodyWithLimit", () => {
  it("concatenates a streamed body under the limit", async () => {
    const { response } = streamResponse([
      new Uint8Array([1, 2]),
      new Uint8Array([3]),
    ]);
    const body = await readBodyWithLimit(response, 3);
    assert.deepEqual(body && Array.from(body), [1, 2, 3]);
  });

  it("stops reading once a body without Content-Length passes the limit", async () => {
    const { response, wasCancelled } = streamResponse([
      new Uint8Array(4),
      new Uint8Array(4),
      new Uint8Array(4),
    ]);
    assert.equal(await readBodyWithLimit(response, 6), null);
    assert.ok(wasCancelled());
  });

  it("does not trust an understated Content-Length", async () => {
    const { response } = streamResponse(
      [new Uint8Array(4), new Uint8Array(4)],
      { "content-length": "1" },
    );
    assert.equal(await readBodyWithLimit(response, 6), null);
  });

  it("rejects an oversized Content-Length without reading", async () => {
    const { response, wasCancelled } = streamResponse([new Uint8Array(1)], {
      "content-length": "100",
    });
    assert.equal(await readBodyWithLimit(response, 10), null);
    assert.ok(wasCancelled());
  });

  it("handles an empty body", async () => {
    const body = await readBodyWithLimit(new Response(null), 10);
    assert.equal(body?.byteLength, 0);
  });
});
