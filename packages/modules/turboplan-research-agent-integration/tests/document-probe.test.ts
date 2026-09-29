import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDownloadableDocument } from "../src/document-preview-utils";
import {
  annotateDocumentDownloadability,
  probeDocumentUrl,
  resolveProbedDocumentType,
} from "../src/server/document-probe";
import { redirectTo, useMockFetch } from "./helpers/mock-fetch";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// Shaped like the CEQAnet attachment links: no extension, served as PDF.
const EXTENSIONLESS = "https://93.184.216.34/299729-1/attachment/ypeMi0A1PIyl";

const headers = (init: Record<string, string>) => new Headers(init);
const withType = (contentType: string, status = 200, extra = {}) =>
  new Response(null, {
    status,
    headers: { "content-type": contentType, ...extra },
  });

describe("resolveProbedDocumentType", () => {
  it("accepts allowlisted types, ignoring parameters", () => {
    assert.equal(
      resolveProbedDocumentType(headers({ "content-type": PDF })),
      PDF,
    );
    assert.equal(
      resolveProbedDocumentType(
        headers({ "content-type": `${DOCX}; charset=binary` }),
      ),
      DOCX,
    );
  });

  it("is definitive for other labelled types", () => {
    assert.equal(
      resolveProbedDocumentType(headers({ "content-type": "text/html" })),
      null,
    );
    assert.equal(
      resolveProbedDocumentType(headers({ "content-type": "image/png" })),
      null,
    );
  });

  it("uses Content-Disposition for octet-stream", () => {
    assert.equal(
      resolveProbedDocumentType(
        headers({
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="EIR.docx"',
        }),
      ),
      DOCX,
    );
    assert.equal(
      resolveProbedDocumentType(
        headers({
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="data.zip"',
        }),
      ),
      undefined,
    );
  });

  it("is inconclusive without a type", () => {
    assert.equal(resolveProbedDocumentType(headers({})), undefined);
    assert.equal(
      resolveProbedDocumentType(
        headers({ "content-type": "application/octet-stream" }),
      ),
      undefined,
    );
  });
});

describe("probeDocumentUrl", () => {
  const mock = useMockFetch();

  it("detects a PDF from HEAD alone", async () => {
    mock.respondWith(() => withType(PDF));
    assert.deepEqual(await probeDocumentUrl(EXTENSIONLESS), {
      isDownloadable: true,
      contentType: PDF,
    });
    assert.deepEqual(
      mock.calls.map((call) => call.method),
      ["HEAD"],
    );
  });

  for (const status of [403, 405]) {
    it(`falls back to a one-byte GET when HEAD returns ${status}`, async () => {
      mock.respondWith((call) =>
        call.method === "HEAD"
          ? new Response(null, { status })
          : withType(PDF, 206),
      );
      assert.deepEqual(await probeDocumentUrl(EXTENSIONLESS), {
        isDownloadable: true,
        contentType: PDF,
      });
      assert.deepEqual(
        mock.calls.map((call) => [call.method, call.headers.Range]),
        [
          ["HEAD", undefined],
          ["GET", "bytes=0-0"],
        ],
      );
    });
  }

  it("falls back to GET when HEAD throws or has no type", async () => {
    let headCalls = 0;
    mock.respondWith((call) => {
      if (call.method === "HEAD") {
        headCalls += 1;
        if (headCalls === 1) {
          throw new TypeError("socket hang up");
        }
        return new Response(null, { status: 200 });
      }
      return withType(PDF, 206);
    });
    assert.equal((await probeDocumentUrl(EXTENSIONLESS)).isDownloadable, true);
    assert.equal((await probeDocumentUrl(EXTENSIONLESS)).isDownloadable, true);
  });

  it("does not read the GET body when Range is ignored", async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    mock.respondWith((call) =>
      call.method === "HEAD"
        ? new Response(null, { status: 405 })
        : new Response(body, { status: 200, headers: { "content-type": PDF } }),
    );
    assert.equal((await probeDocumentUrl(EXTENSIONLESS)).isDownloadable, true);
    assert.ok(cancelled);
    assert.ok(pulled <= 1);
  });

  it("stops at a definitive non-document HEAD", async () => {
    mock.respondWith(() => withType("text/html; charset=utf-8"));
    assert.deepEqual(await probeDocumentUrl(EXTENSIONLESS), {
      isDownloadable: false,
    });
    assert.equal(mock.calls.length, 1);
  });

  it("follows redirects to the file", async () => {
    mock.respondWith((call) =>
      call.url === EXTENSIONLESS ? redirectTo("/files/1") : withType(PDF),
    );
    assert.equal((await probeDocumentUrl(EXTENSIONLESS)).isDownloadable, true);
  });

  it("treats blocked redirects as not downloadable without retrying", async () => {
    mock.respondWith(() => redirectTo("http://169.254.169.254/"));
    assert.deepEqual(await probeDocumentUrl(EXTENSIONLESS), {
      isDownloadable: false,
    });
    assert.equal(mock.calls.length, 1);
  });

  it("never contacts unsafe hosts", async () => {
    mock.respondWith(() => withType(PDF));
    assert.equal(
      (await probeDocumentUrl("http://10.0.0.1/doc")).isDownloadable,
      false,
    );
    assert.equal(mock.calls.length, 0);
  });

  it("treats network failures on both requests as not downloadable", async () => {
    mock.respondWith(() => {
      throw new TypeError("fetch failed");
    });
    assert.deepEqual(await probeDocumentUrl(EXTENSIONLESS), {
      isDownloadable: false,
    });
  });

  it("treats a non-document GET as not downloadable", async () => {
    mock.respondWith((call) =>
      call.method === "HEAD"
        ? new Response(null, { status: 405 })
        : withType("text/html"),
    );
    assert.equal((await probeDocumentUrl(EXTENSIONLESS)).isDownloadable, false);
  });
});

describe("annotateDocumentDownloadability", () => {
  it("probes only URLs without a document extension", async () => {
    const probed: string[] = [];
    const docs = [
      { url: "https://gov.example/plan.pdf", title: "a" },
      {
        url: "https://app.box.com/index.php?rm=box_download_shared_file&x=1",
        title: "b",
      },
      { url: "https://gov.example/attachment/abc", title: "c" },
      { url: "https://gov.example/page", title: "d" },
    ];
    const result = await annotateDocumentDownloadability(docs, async (url) => {
      probed.push(url);
      return url.endsWith("abc")
        ? { isDownloadable: true, contentType: PDF }
        : { isDownloadable: false };
    });

    assert.deepEqual(probed, [
      "https://gov.example/attachment/abc",
      "https://gov.example/page",
    ]);
    assert.deepEqual(result, [
      docs[0],
      docs[1],
      { ...docs[2], isDownloadable: true, contentType: PDF },
      { ...docs[3], isDownloadable: false },
    ]);
  });

  it("limits concurrency", async () => {
    let active = 0;
    let peak = 0;
    const docs = Array.from({ length: 30 }, (_, i) => ({
      url: `https://gov.example/doc/${i}`,
    }));
    await annotateDocumentDownloadability(docs, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { isDownloadable: false };
    });
    assert.ok(peak > 1, "probes run in parallel");
    assert.ok(peak <= 8, `peak concurrency ${peak}`);
  });
});

describe("isDownloadableDocument", () => {
  it("prefers the persisted flag over the URL shape", () => {
    assert.equal(
      isDownloadableDocument({ url: EXTENSIONLESS, isDownloadable: true }),
      true,
    );
    assert.equal(
      isDownloadableDocument({
        url: "https://gov.example/x.pdf",
        isDownloadable: false,
      }),
      false,
    );
  });

  it("falls back to the URL shape for documents stored before probing", () => {
    assert.equal(isDownloadableDocument({ url: EXTENSIONLESS }), false);
    assert.equal(
      isDownloadableDocument({ url: "https://gov.example/x.PDF?dl=1" }),
      true,
    );
  });
});
