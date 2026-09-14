import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

process.env.AUTH_SECRET = "test-secret";
process.env.POSTGRES_URL = "postgresql://test";
process.env.TURBOPLAN_URL = "https://app.example.test";
process.env.LANDING_URL = "https://landing.example.test";
process.env.IS_TASKS_PACKAGE_ENABLED = "false";
process.env.IS_MAPS_PACKAGE_ENABLED = "false";
process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED = "false";
process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED = "false";

const {
  uploadDocumentsFromUrlsSchema,
  processUrlDocument,
  MAX_DOCUMENTS_PER_BATCH,
} = await import("../src/tools/documents.js");

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const USER = {
  userId: "22222222-2222-2222-2222-222222222222",
  email: "hermes@example.test",
  actor: "hermes",
  patId: "33333333-3333-3333-3333-333333333333",
};

const originalFetch = globalThis.fetch;

describe("upload_documents_from_urls input schema", () => {
  it("accepts a happy-path multi-item batch", () => {
    const result = uploadDocumentsFromUrlsSchema.safeParse([
      { url: "https://example.test/a.pdf", originalFilename: "a.pdf" },
      { url: "https://example.test/b.pdf", originalFilename: "b.pdf" },
    ]);
    assert.strictEqual(result.success, true);
  });

  it("rejects duplicate URLs within the batch", () => {
    const result = uploadDocumentsFromUrlsSchema.safeParse([
      { url: "https://example.test/a.pdf", originalFilename: "a.pdf" },
      { url: "https://example.test/a.pdf", originalFilename: "a-copy.pdf" },
    ]);
    assert.strictEqual(result.success, false);
    if (result.success) {
      return;
    }
    assert.ok(
      result.error.issues.some((i) => i.message.includes("Duplicate URL")),
    );
  });

  it("rejects an empty batch", () => {
    const result = uploadDocumentsFromUrlsSchema.safeParse([]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a batch that exceeds the per-call cap", () => {
    const tooMany = Array.from(
      { length: MAX_DOCUMENTS_PER_BATCH + 1 },
      (_, i) => ({
        url: `https://example.test/doc-${i}.pdf`,
        originalFilename: `doc-${i}.pdf`,
      }),
    );
    const result = uploadDocumentsFromUrlsSchema.safeParse(tooMany);
    assert.strictEqual(result.success, false);
  });
});

describe("processUrlDocument per-item error reporting", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports a network failure without throwing", async () => {
    globalThis.fetch = () => Promise.reject(new Error("boom"));

    const result = await processUrlDocument(
      PROJECT_ID,
      { url: "https://example.test/a.pdf", originalFilename: "a.pdf" },
      USER,
    );

    assert.strictEqual(result.success, false);
    if (result.success) {
      return;
    }
    assert.strictEqual(result.error, "Failed to fetch document from URL.");
  });

  it("reports a non-2xx HTTP status", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(null, { status: 404, headers: {} }));

    const result = await processUrlDocument(
      PROJECT_ID,
      { url: "https://example.test/missing.pdf", originalFilename: "m.pdf" },
      USER,
    );

    assert.strictEqual(result.success, false);
    if (result.success) {
      return;
    }
    assert.strictEqual(result.error, "URL returned HTTP 404.");
  });

  it("reports an unsupported content type", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );

    const result = await processUrlDocument(
      PROJECT_ID,
      { url: "https://example.test/page.html", originalFilename: "p.pdf" },
      USER,
    );

    assert.strictEqual(result.success, false);
    if (result.success) {
      return;
    }
    assert.ok(result.error.startsWith("Unsupported file type: text/html"));
  });

  it("reports a file that exceeds the size limit via content-length", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response("data", {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(60 * 1024 * 1024),
          },
        }),
      );

    const result = await processUrlDocument(
      PROJECT_ID,
      { url: "https://example.test/big.pdf", originalFilename: "big.pdf" },
      USER,
    );

    assert.strictEqual(result.success, false);
    if (result.success) {
      return;
    }
    assert.strictEqual(result.error, "File exceeds 50MB size limit.");
  });
});
