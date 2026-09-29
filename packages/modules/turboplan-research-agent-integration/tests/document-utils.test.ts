import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSafeDocumentFilename,
  getDocumentMimeTypeForFilename,
  parseContentDispositionFilename,
  parseMediaType,
  readBodyWithLimit,
  resolveDocumentMimeType,
} from "../src/server/document-utils";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7");
const HTML_BYTES = new TextEncoder().encode("<html>");
const DOC = "application/msword";
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
const OLE_BYTES = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00,
]);
const BINARY_BYTES = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

describe("parseMediaType", () => {
  it("drops parameters, whitespace and case", () => {
    assert.equal(parseMediaType(" Application/PDF ; charset=binary"), PDF);
    assert.equal(parseMediaType("text/html;charset=utf-8"), "text/html");
    assert.equal(parseMediaType(null), "");
    assert.equal(parseMediaType(""), "");
  });
});

describe("parseContentDispositionFilename", () => {
  it("reads quoted, bare and RFC 5987 filenames", () => {
    assert.equal(
      parseContentDispositionFilename('attachment; filename="Plan A.pdf"'),
      "Plan A.pdf",
    );
    assert.equal(
      parseContentDispositionFilename("inline; filename=report.docx; size=1"),
      "report.docx",
    );
    assert.equal(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.bin\"; filename*=UTF-8''Plan%20%C3%A9.pdf",
      ),
      "Plan é.pdf",
    );
  });

  it("returns null when there is no filename", () => {
    assert.equal(parseContentDispositionFilename(null), null);
    assert.equal(parseContentDispositionFilename("attachment"), null);
    assert.equal(
      parseContentDispositionFilename('attachment; filename=""'),
      null,
    );
  });
});

describe("getDocumentMimeTypeForFilename", () => {
  it("maps document extensions only", () => {
    assert.equal(getDocumentMimeTypeForFilename("A.PDF"), PDF);
    assert.equal(getDocumentMimeTypeForFilename("a.doc"), DOC);
    assert.equal(getDocumentMimeTypeForFilename("a.docx"), DOCX);
    assert.equal(getDocumentMimeTypeForFilename("a.html"), null);
    assert.equal(getDocumentMimeTypeForFilename(null), null);
  });
});

describe("resolveDocumentMimeType", () => {
  it("accepts allowlisted document types, ignoring parameters and case", () => {
    assert.equal(resolveDocumentMimeType(PDF, BINARY_BYTES), PDF);
    assert.equal(
      resolveDocumentMimeType("Application/PDF; charset=binary", BINARY_BYTES),
      PDF,
    );
    assert.equal(resolveDocumentMimeType(DOCX, BINARY_BYTES), DOCX);
    assert.equal(
      resolveDocumentMimeType("application/msword", BINARY_BYTES),
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

  it("never stores HTML, whatever the header claims", () => {
    for (const markup of [
      "<!DOCTYPE html><html>",
      "\n  <html lang=en>",
      "\ufeff<!doctype html>",
    ]) {
      const body = new TextEncoder().encode(markup);
      assert.equal(resolveDocumentMimeType(PDF, body), null);
      assert.equal(resolveDocumentMimeType(DOCX, body), null);
      assert.equal(resolveDocumentMimeType(null, body), null);
    }
  });

  it("accepts unlabelled Word files only with a matching filename and magic", () => {
    const docxDisposition = 'attachment; filename="plan.docx"';
    const docDisposition = 'attachment; filename="plan.doc"';
    assert.equal(
      resolveDocumentMimeType(
        "application/octet-stream",
        ZIP_BYTES,
        docxDisposition,
      ),
      DOCX,
    );
    assert.equal(resolveDocumentMimeType(null, OLE_BYTES, docDisposition), DOC);
    // Right filename, wrong bytes.
    assert.equal(
      resolveDocumentMimeType(
        "application/octet-stream",
        BINARY_BYTES,
        docxDisposition,
      ),
      null,
    );
    // Right bytes, no filename.
    assert.equal(
      resolveDocumentMimeType("application/octet-stream", ZIP_BYTES),
      null,
    );
    // A labelled non-document type is not rescued by the filename.
    assert.equal(
      resolveDocumentMimeType("application/zip", ZIP_BYTES, docxDisposition),
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
      buildSafeDocumentFilename("https://gov.example/report", "", DOCX),
      "report.docx",
    );
    assert.equal(
      buildSafeDocumentFilename("https://gov.example/REPORT.PDF", "T", PDF),
      "REPORT.PDF",
    );
  });

  it("names extensionless URLs after the title, with the type's extension", () => {
    assert.equal(
      buildSafeDocumentFilename(
        "https://files.ceqanet.lci.ca.gov/299729-1/attachment/ypeMi0A1PIyl-Q6sPERUenDuNb3gT",
        "Draft Initial Study",
        PDF,
      ),
      "Draft Initial Study.pdf",
    );
    assert.equal(
      buildSafeDocumentFilename(
        "https://gov.example/download?id=7",
        "Plan",
        DOCX,
      ),
      "Plan.docx",
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
      `https://gov.example/${"a".repeat(500)}.pdf`,
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
