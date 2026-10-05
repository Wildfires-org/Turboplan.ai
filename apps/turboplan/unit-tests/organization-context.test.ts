import assert from "node:assert";
import { describe, it } from "node:test";

import { PROJECT_DOCUMENT_MAX_FILE_SIZE } from "@wildfires-org/turboplan-upload/types";
import {
  ORGANIZATION_DOCUMENTS_MAX,
  ORGANIZATION_PROMPT_MAX_CHARS,
} from "@wildfires-org/turboplan-workspace/types";

import { getDocumentDedupeKey } from "../lib/document-upload-queue";
import {
  formatFileSize,
  getDocumentTypeLabel,
  getOrganizationDocumentStatus,
  getOrganizationDropRowStatus,
  getProcessingAnnouncement,
  getPromptLength,
  isAtDocumentLimit,
  organizationPromptSchema,
  planOrganizationDrop,
  sortOrganizationDocuments,
} from "../lib/organization-context";
import type { OrganizationDocument } from "../types/organization-context";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const file = (name: string, size = 1000, type = PDF) => ({ name, size, type });

const makeDocument = (
  overrides: Partial<OrganizationDocument> = {},
): OrganizationDocument => ({
  id: "doc-1",
  organizationId: "org-1",
  filename: "stored.pdf",
  originalFilename: "policy.pdf",
  mimeType: PDF,
  size: 1000,
  url: "https://files.example.test/uploads/user/stored.pdf",
  uploadedBy: "user-1",
  isPinned: false,
  extractionStatus: "done",
  extractionError: null,
  extractedAt: null,
  summary: "- Key fact",
  summarizedAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  ...overrides,
});

describe("organizationPromptSchema", () => {
  it("trims the prompt", () => {
    const result = organizationPromptSchema.parse({ prompt: "  Hello  " });
    assert.strictEqual(result.prompt, "Hello");
  });

  it("accepts an empty prompt (clears it)", () => {
    assert.strictEqual(
      organizationPromptSchema.safeParse({ prompt: "" }).success,
      true,
    );
  });

  it("allows the maximum after trimming and rejects one more", () => {
    const max = "a".repeat(ORGANIZATION_PROMPT_MAX_CHARS);
    assert.strictEqual(
      organizationPromptSchema.safeParse({ prompt: `  ${max}\n` }).success,
      true,
    );
    assert.strictEqual(
      organizationPromptSchema.safeParse({ prompt: `${max}a` }).success,
      false,
    );
  });

  it("counts what the API validates", () => {
    assert.strictEqual(getPromptLength("  abc \n"), 3);
  });
});

describe("planOrganizationDrop", () => {
  it("queues documents and rejects other files with a reason", () => {
    const plan = planOrganizationDrop(
      [
        file("a.pdf"),
        file("b.docx", 10, DOCX),
        file("map.zip", 10, "application/zip"),
        file("empty.pdf", 0),
        file("huge.pdf", PROJECT_DOCUMENT_MAX_FILE_SIZE + 1),
      ],
      new Set(),
    );

    assert.deepStrictEqual(
      plan.map((item) => item.phase),
      ["queued", "queued", "error", "error", "error"],
    );
    assert.match(plan[2].message ?? "", /PDF and Word/);
    assert.match(plan[3].message ?? "", /empty/);
    assert.match(plan[4].message ?? "", /too large/);
  });

  it("skips files already listed or queued, and repeats within a drop", () => {
    const blocked = new Set([getDocumentDedupeKey("listed.pdf", 1000)]);
    const plan = planOrganizationDrop(
      [
        file("listed.pdf"),
        file("new.pdf"),
        file("new.pdf"),
        file("new.pdf", 2),
      ],
      blocked,
    );

    assert.deepStrictEqual(
      plan.map((item) => item.phase),
      ["duplicate", "queued", "duplicate", "queued"],
    );
  });

  it("does not change the blocked keys it is given", () => {
    const blocked = new Set<string>();
    planOrganizationDrop([file("a.pdf")], blocked);
    assert.strictEqual(blocked.size, 0);
  });
});

describe("isAtDocumentLimit", () => {
  const listed = Array.from(
    { length: ORGANIZATION_DOCUMENTS_MAX - 1 },
    (_, index) => ({
      id: `doc-${index}`,
    }),
  );

  it("is false one below the limit", () => {
    assert.strictEqual(isAtDocumentLimit(listed, new Map()), false);
  });

  it("counts documents added this session that are not listed yet", () => {
    assert.strictEqual(
      isAtDocumentLimit(listed, new Map([["new-doc", "new.pdf:1"]])),
      true,
    );
  });

  it("does not count an added document twice once listed", () => {
    assert.strictEqual(
      isAtDocumentLimit(listed, new Map([["doc-0", "a.pdf:1"]])),
      false,
    );
  });
});

describe("getOrganizationDropRowStatus", () => {
  it("lets queued rows be removed but not uploading ones", () => {
    const queued = getOrganizationDropRowStatus({
      id: "1",
      name: "a.pdf",
      phase: "queued",
    });
    const uploading = getOrganizationDropRowStatus({
      id: "1",
      name: "a.pdf",
      phase: "uploading",
      progress: 40,
    });
    assert.strictEqual(queued.isDismissable, true);
    assert.strictEqual(queued.isFinished, false);
    assert.strictEqual(uploading.isDismissable, false);
  });

  it("shows the error message of a failed row", () => {
    const status = getOrganizationDropRowStatus({
      id: "1",
      name: "a.pdf",
      phase: "error",
      message: "Upload failed",
    });
    assert.strictEqual(status.tone, "error");
    assert.strictEqual(status.detail, "Upload failed");
    assert.strictEqual(status.isFinished, true);
  });
});

describe("getOrganizationDocumentStatus", () => {
  it("is processing while pending, then waiting once stale", () => {
    const pending = makeDocument({
      extractionStatus: "pending",
      summary: null,
    });
    assert.strictEqual(
      getOrganizationDocumentStatus(pending, false).label,
      "Processing",
    );
    assert.strictEqual(
      getOrganizationDocumentStatus(pending, true).label,
      "Waiting to process",
    );
  });

  it("is ready with a summary and explains the excerpt without one", () => {
    assert.strictEqual(
      getOrganizationDocumentStatus(makeDocument(), false).label,
      "Ready",
    );
    const noSummary = getOrganizationDocumentStatus(
      makeDocument({ summary: null }),
      false,
    );
    assert.strictEqual(noSummary.label, "Summary unavailable");
    assert.match(noSummary.detail ?? "", /first 400 characters/);
  });

  it("shows the extraction error of a failed or unsupported document", () => {
    const failed = getOrganizationDocumentStatus(
      makeDocument({
        extractionStatus: "failed",
        extractionError: "Corrupt PDF",
      }),
      false,
    );
    assert.strictEqual(failed.label, "Failed");
    assert.strictEqual(failed.detail, "Corrupt PDF");
    assert.strictEqual(
      getOrganizationDocumentStatus(
        makeDocument({ extractionStatus: "unsupported" }),
        false,
      ).label,
      "Unsupported",
    );
  });
});

describe("sortOrganizationDocuments", () => {
  it("puts key documents first, then newest first", () => {
    const sorted = sortOrganizationDocuments([
      makeDocument({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      makeDocument({ id: "new", createdAt: "2026-10-01T00:00:00.000Z" }),
      makeDocument({
        id: "old-key",
        isPinned: true,
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    assert.deepStrictEqual(
      sorted.map((document) => document.id),
      ["old-key", "new", "old"],
    );
  });
});

describe("getProcessingAnnouncement", () => {
  it("says nothing on first load", () => {
    assert.strictEqual(getProcessingAnnouncement(null, [makeDocument()]), null);
  });

  it("announces documents that just finished processing", () => {
    const previous = new Map([
      ["doc-1", "pending" as const],
      ["doc-2", "pending" as const],
    ]);
    const message = getProcessingAnnouncement(previous, [
      makeDocument({ id: "doc-1", originalFilename: "a.pdf" }),
      makeDocument({
        id: "doc-2",
        originalFilename: "b.pdf",
        extractionStatus: "pending",
      }),
    ]);
    assert.strictEqual(message, "a.pdf: Ready");
  });
});

describe("formatting", () => {
  it("formats file sizes", () => {
    assert.strictEqual(formatFileSize(512), "512 B");
    assert.strictEqual(formatFileSize(2048), "2 KB");
    assert.strictEqual(formatFileSize(5 * 1024 * 1024), "5.0 MB");
  });

  it("labels document types", () => {
    assert.strictEqual(getDocumentTypeLabel(PDF), "PDF");
    assert.strictEqual(getDocumentTypeLabel(DOCX), "DOCX");
    assert.strictEqual(getDocumentTypeLabel("application/msword"), "DOC");
    assert.strictEqual(getDocumentTypeLabel("text/plain"), "File");
  });
});
