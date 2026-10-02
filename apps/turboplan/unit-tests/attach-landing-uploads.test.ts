import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type * as AttachModule from "../app/self-service/attach-landing-uploads";

const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const PDF = "application/pdf";

const stagingKey = (name: string) =>
  `landing-uploads/1730000000000-${UUID}-${name}`;

type Claimed = {
  url: string;
  key: string;
  size: number;
  contentType: string;
  originalFilename: string;
};

const claimedFor = (name: string): Claimed => {
  const key = `uploads/${USER_ID}/1730000000000-${UUID}-${name}`;
  return {
    url: `https://files.example.test/${key}`,
    key,
    size: 1234,
    contentType: PDF,
    originalFilename: name,
  };
};

// Per-key behaviour of the mocked claim: a result, null (missing) or a throw.
let claimOutcomes: Record<string, Claimed | null | Error> = {};
let failRegistrationFor = new Set<string>();
let failTimelineFor = new Set<string>();
// Per-key behaviour of the mocked inspection: a result, null (missing) or a throw.
let inspectOutcomes: Record<string, { originalFilename: string } | Error> = {};

const claimLandingUpload = mock.fn(async (key: string, _userId: string) => {
  const outcome = claimOutcomes[key];
  if (outcome instanceof Error) {
    throw outcome;
  }
  return outcome ?? null;
});
const inspectLandingUpload = mock.fn(async (key: string) => {
  const outcome = inspectOutcomes[key];
  if (outcome instanceof Error) {
    throw outcome;
  }
  return outcome ?? null;
});
const deleteOwnedStorageFile = mock.fn(
  async (_url: string, _owner: unknown) => true,
);
const createProjectDocument = mock.fn(
  async (data: { originalFilename: string; url: string; mimeType: string }) => {
    if (failRegistrationFor.has(data.originalFilename)) {
      throw new Error("insert failed");
    }
    return { id: `doc-${data.originalFilename}`, ...data };
  },
);
const createTimelineRecord = mock.fn(async (input: { entityName: string }) => {
  if (failTimelineFor.has(input.entityName)) {
    throw new Error("timeline insert failed");
  }
});

mock.module("server-only", { namedExports: {} });
mock.module("@wildfires-org/turboplan-upload/server", {
  namedExports: {
    claimLandingUpload,
    deleteOwnedStorageFile,
    inspectLandingUpload,
  },
});
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: { createProjectDocument },
});
mock.module("@wildfires-org/turboplan-timeline-records/server", {
  namedExports: { createTimelineRecord },
});

let attach: typeof AttachModule;

before(async () => {
  attach = await import("../app/self-service/attach-landing-uploads");
});

beforeEach(() => {
  claimOutcomes = {};
  failRegistrationFor = new Set();
  failTimelineFor = new Set();
  inspectOutcomes = {};
  for (const fn of [
    claimLandingUpload,
    inspectLandingUpload,
    deleteOwnedStorageFile,
    createProjectDocument,
    createTimelineRecord,
  ]) {
    fn.mock.resetCalls();
  }
  mock.method(console, "error", () => {});
  mock.method(console, "warn", () => {});
});

const run = (keys: unknown) =>
  attach.attachLandingUploads({
    keys: keys as string[] | undefined,
    projectId: PROJECT_ID,
    userId: USER_ID,
    logPrefix: "[test]",
  });

describe("attachLandingUploads", () => {
  it("does nothing without keys", async () => {
    assert.deepStrictEqual(await run(undefined), []);
    assert.deepStrictEqual(await run([]), []);
    assert.strictEqual(claimLandingUpload.mock.callCount(), 0);
  });

  it("ignores a malformed payload instead of failing", async () => {
    for (const keys of [
      "landing-uploads/x",
      [1, 2],
      Array.from({ length: 6 }, (_, i) => stagingKey(`${i}.pdf`)),
    ]) {
      assert.deepStrictEqual(await run(keys), [], JSON.stringify(keys));
    }
    assert.strictEqual(claimLandingUpload.mock.callCount(), 0);
  });

  it("registers each claimed file like POST /api/project-documents", async () => {
    claimOutcomes[stagingKey("plan.pdf")] = claimedFor("plan.pdf");

    assert.deepStrictEqual(await run([stagingKey("plan.pdf")]), ["plan.pdf"]);

    assert.deepStrictEqual(claimLandingUpload.mock.calls[0].arguments, [
      stagingKey("plan.pdf"),
      USER_ID,
    ]);
    const claimed = claimedFor("plan.pdf");
    assert.deepStrictEqual(createProjectDocument.mock.calls[0].arguments[0], {
      projectId: PROJECT_ID,
      userId: USER_ID,
      filename: `1730000000000-${UUID}-plan.pdf`,
      originalFilename: "plan.pdf",
      mimeType: PDF,
      size: 1234,
      url: claimed.url,
    });
    assert.deepStrictEqual(createTimelineRecord.mock.calls[0].arguments[0], {
      projectId: PROJECT_ID,
      userId: USER_ID,
      entityType: "document",
      entityId: "doc-plan.pdf",
      entityName: "plan.pdf",
      action: "created",
      resourceUrls: [{ url: claimed.url, filename: "plan.pdf", type: PDF }],
    });
  });

  it("skips failed files and keeps the rest", async () => {
    claimOutcomes = {
      [stagingKey("ok.pdf")]: claimedFor("ok.pdf"),
      [stagingKey("bad-key.pdf")]: new Error("Invalid landing upload key"),
      [stagingKey("gone.pdf")]: null,
      [stagingKey("db.pdf")]: claimedFor("db.pdf"),
    };
    failRegistrationFor.add("db.pdf");

    const names = await run([
      stagingKey("bad-key.pdf"),
      stagingKey("ok.pdf"),
      stagingKey("gone.pdf"),
      stagingKey("db.pdf"),
    ]);

    assert.deepStrictEqual(names, ["ok.pdf"]);
    assert.strictEqual(createTimelineRecord.mock.callCount(), 1);
    // The copy that never got a row is removed, scoped to its owner.
    assert.deepStrictEqual(deleteOwnedStorageFile.mock.calls[0].arguments, [
      claimedFor("db.pdf").url,
      { userId: USER_ID },
    ]);
  });

  it("keeps a registered document when its timeline record fails", async () => {
    claimOutcomes[stagingKey("plan.pdf")] = claimedFor("plan.pdf");
    failTimelineFor.add("plan.pdf");

    assert.deepStrictEqual(await run([stagingKey("plan.pdf")]), ["plan.pdf"]);

    assert.strictEqual(createProjectDocument.mock.callCount(), 1);
    assert.strictEqual(createTimelineRecord.mock.callCount(), 1);
    // The row points at the stored file, so it must survive.
    assert.strictEqual(deleteOwnedStorageFile.mock.callCount(), 0);
  });

  it("claims a repeated key once", async () => {
    claimOutcomes[stagingKey("a.pdf")] = claimedFor("a.pdf");

    assert.deepStrictEqual(
      await run([stagingKey("a.pdf"), stagingKey("a.pdf")]),
      ["a.pdf"],
    );
    assert.strictEqual(claimLandingUpload.mock.callCount(), 1);
  });
});

describe("findAttachableLandingUploads", () => {
  const find = (keys: unknown) =>
    attach.findAttachableLandingUploads({
      keys: keys as string[] | undefined,
      logPrefix: "[test]",
    });

  it("names only uploads storage holds and the claim would accept", async () => {
    inspectOutcomes = {
      [stagingKey("plan.pdf")]: { originalFilename: "plan.pdf" },
      [stagingKey("brief.docx")]: { originalFilename: "brief.docx" },
      [stagingKey("page.html")]: new Error("Unsupported file type"),
    };

    assert.deepStrictEqual(
      await find([
        stagingKey("plan.pdf"),
        // Missing: expired, never uploaded, or a key made up on the link
        stagingKey("missing.pdf"),
        stagingKey("page.html"),
        stagingKey("plan.pdf"),
        stagingKey("brief.docx"),
      ]),
      [
        { key: stagingKey("plan.pdf"), name: "plan.pdf" },
        { key: stagingKey("brief.docx"), name: "brief.docx" },
      ],
    );
    // Inspecting never claims.
    assert.strictEqual(inspectLandingUpload.mock.callCount(), 4);
    assert.strictEqual(claimLandingUpload.mock.callCount(), 0);
  });

  it("finds nothing for missing or malformed keys", async () => {
    assert.deepStrictEqual(await find(undefined), []);
    assert.deepStrictEqual(
      await find(Array.from({ length: 6 }, (_, i) => stagingKey(`${i}.pdf`))),
      [],
    );
    assert.strictEqual(inspectLandingUpload.mock.callCount(), 0);
  });
});

describe("withAttachedDocumentsNote", () => {
  it("leaves the prompt alone when nothing was attached", () => {
    assert.strictEqual(
      attach.withAttachedDocumentsNote("Build a trail", []),
      "Build a trail",
    );
    assert.strictEqual(
      attach.withAttachedDocumentsNote(undefined, []),
      undefined,
    );
  });

  it("follows the prompt with a request to read the documents", () => {
    assert.strictEqual(
      attach.withAttachedDocumentsNote("Build a trail", ["plan.pdf"]),
      'Build a trail\n\nI\'ve attached "plan.pdf" to the project documents — please read it and use what you learn as context for the project.',
    );
    assert.strictEqual(
      attach.withAttachedDocumentsNote(undefined, ["a.pdf", "b.docx"]),
      'I\'ve attached "a.pdf", "b.docx" to the project documents — please read them and use what you learn as context for the project.',
    );
  });

  it("JSON-quotes names so one cannot close its quotes", () => {
    assert.strictEqual(
      attach.withAttachedDocumentsNote(undefined, ['a".pdf']),
      'I\'ve attached "a\\".pdf" to the project documents — please read it and use what you learn as context for the project.',
    );
  });
});
