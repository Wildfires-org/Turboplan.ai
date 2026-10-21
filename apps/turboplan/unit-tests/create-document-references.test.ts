import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";

import type { ProjectDocumentExtraction } from "@wildfires-org/turboplan-db/queries";
import { resetEnvCache } from "@wildfires-org/turboplan-env";

import type * as CreateDocumentModule from "../lib/ai/tools/create-document";
import type { CreateDocumentCallbackProps } from "../lib/artifacts/server";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_PROJECT_ID = "00000000-0000-4000-8000-0000000000a2";
const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000b1";
const USER_ID = "00000000-0000-4000-8000-0000000000c1";
const DOCUMENT_ID = "00000000-0000-4000-8000-0000000000d1";
const PENDING_ID = "00000000-0000-4000-8000-0000000000d2";
const LINK_ID = "00000000-0000-4000-8000-0000000000d3";
const THIRD_ID = "00000000-0000-4000-8000-0000000000d4";
const RESEARCH_ID = "00000000-0000-4000-8000-0000000000d6";
const FOREIGN_ID = "00000000-0000-4000-8000-0000000000e1";
const STORAGE_BASE = "https://files.example.test";
const STORAGE_URL = `${STORAGE_BASE}/uploads/user/agency-letter.pdf`;
const WEB_URL = "https://example.gov/letter.pdf";

const savedRow: ProjectDocumentExtraction = {
  id: DOCUMENT_ID,
  projectId: PROJECT_ID,
  url: STORAGE_URL,
  originalFilename: "agency-letter.pdf",
  mimeType: "application/pdf",
  source: "upload",
  extractionStatus: "done",
  extractedText: "Saved letter text",
  extractionError: null,
};

// An analog project's letter the research agent saved to this project.
const researchRow: ProjectDocumentExtraction = {
  ...savedRow,
  id: RESEARCH_ID,
  url: `${STORAGE_BASE}/research/user/analog-letter.pdf`,
  originalFilename: "analog-letter.pdf",
  source: "research",
  extractedText: "Analog letter text",
};

const pendingRow: ProjectDocumentExtraction = {
  ...savedRow,
  id: PENDING_ID,
  url: `${STORAGE_BASE}/uploads/user/draft.pdf`,
  originalFilename: "draft.pdf",
  extractionStatus: "pending",
  extractedText: null,
};

// A research "link only" document: saved as its public page URL, never read.
const linkRow: ProjectDocumentExtraction = {
  ...savedRow,
  id: LINK_ID,
  url: "https://agency.example.gov/project-page",
  originalFilename: "Agency project page",
  mimeType: "text/html",
  extractionStatus: "unsupported",
  extractedText: null,
};

const foreignRow: ProjectDocumentExtraction = {
  ...savedRow,
  id: FOREIGN_ID,
  projectId: OTHER_PROJECT_ID,
  url: `${STORAGE_BASE}/uploads/other/secret.pdf`,
  originalFilename: "secret.pdf",
  extractedText: "Another project's text",
};

let projectRows: ProjectDocumentExtraction[] = [];
const handlerCalls: CreateDocumentCallbackProps[] = [];
const exaCalls: string[][] = [];
const queryCalls: string[] = [];
const timingEvents: Array<Record<string, unknown>> = [];

mock.module("@wildfires-org/turboplan-ai", {
  namedExports: { getPrompt: async () => "Create a document." },
});
mock.module("@wildfires-org/turboplan-feature-flags", {
  namedExports: {
    isMapPackageEnabled: () => false,
    isTasksPackageEnabled: () => true,
  },
});
// The id lookup is unscoped like the real one; the listing is per project.
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    getProjectDocumentExtractionByIds: async (ids: string[]) => {
      queryCalls.push("project-texts");
      return projectRows.filter((row) => ids.includes(row.id));
    },
    getProjectDocumentsByProjectId: async (projectId: string) => {
      queryCalls.push("project-listing");
      return projectRows.filter((row) => row.projectId === projectId);
    },
    listOrganizationDocuments: async () => {
      queryCalls.push("organization-listing");
      return [];
    },
    getOrganizationDocumentTextsByIds: async () => {
      queryCalls.push("organization-texts");
      return [];
    },
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async () => ({ allowed: true }),
    }),
  },
});
// The letterhead choice (only with a letterheadId) and the reference copy
// (only with saved references), set per test.
let chosenLetterhead: { selection: string; letterhead: unknown } = {
  selection: "default",
  letterhead: undefined,
};
// `selected` defaults to the caller's `select`; a research reference's copy
// comes back unselected from the real function.
let copiedLetterhead: {
  letterhead: unknown;
  referenceFilename: string;
  selected?: boolean;
} | null = null;
let pendingLetterheads: string[] = [];
const chooseDocumentLetterhead = mock.fn(
  async (_args: Record<string, unknown>) => chosenLetterhead,
);
const copyReferenceLetterhead = mock.fn(
  async (args: Record<string, unknown>) => ({
    copied: copiedLetterhead
      ? {
          ...copiedLetterhead,
          selected: copiedLetterhead.selected ?? args.select === true,
        }
      : null,
    pendingFilenames: pendingLetterheads,
  }),
);
mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: { chooseDocumentLetterhead, copyReferenceLetterhead },
});
const recordingHandler = (kind: string) => ({
  kind,
  onCreateDocument: async (props: CreateDocumentCallbackProps) => {
    handlerCalls.push(props);
  },
});
mock.module("../lib/artifacts/server", {
  namedExports: {
    artifactKinds: ["text", "tasks"],
    documentHandlers: [recordingHandler("text"), recordingHandler("tasks")],
  },
});
mock.module("../lib/server-analytics", {
  namedExports: { trackAnalyticsEvent: () => {} },
});
mock.module("../lib/ai/exa-client", {
  namedExports: {
    exaGetContents: async (urls: string[]) => {
      exaCalls.push(urls);
      return {
        results: urls.map((url) => ({ url, title: "Web", text: "Web text" })),
      };
    },
  },
});

// The real storage host / canonical URL logic runs against R2_PUBLIC_URL.
// The turboplan app resolves as CJS, so import after the mocks are registered.
let createDocumentModule: typeof CreateDocumentModule;

before(async () => {
  process.env.R2_PUBLIC_URL = STORAGE_BASE;
  resetEnvCache();
  createDocumentModule = await import("../lib/ai/tools/create-document");
});

beforeEach(() => {
  projectRows = [savedRow];
  handlerCalls.length = 0;
  exaCalls.length = 0;
  queryCalls.length = 0;
  timingEvents.length = 0;
  chosenLetterhead = { selection: "default", letterhead: undefined };
  copiedLetterhead = null;
  pendingLetterheads = [];
  chooseDocumentLetterhead.mock.resetCalls();
  copyReferenceLetterhead.mock.resetCalls();
});

const runCreateDocument = async (input: Record<string, unknown>) => {
  const createDocumentTool = await createDocumentModule.createDocument({
    session: { user: { id: USER_ID } } as Session,
    writer: { write: () => {} } as unknown as UIMessageStreamWriter,
    projectId: PROJECT_ID,
    organizationId: ORGANIZATION_ID,
    chatId: "chat-1",
    referenceCache: { remember: () => {}, get: () => undefined },
  });
  const originalLog = console.log;
  console.log = (entry: unknown) => {
    if (
      typeof entry === "object" &&
      entry !== null &&
      String((entry as { message?: unknown }).message).startsWith(
        "[ChatTiming]",
      )
    ) {
      timingEvents.push(entry as Record<string, unknown>);
    }
  };
  try {
    return await createDocumentTool.execute?.(
      { title: "Scoping letter", kind: "text", ...input },
      { toolCallId: "call-1", messages: [] },
    );
  } finally {
    console.log = originalLog;
  }
};

const referencesOf = (result: unknown) =>
  (result as { references?: unknown }).references;

const loadedReferences = async () =>
  (await handlerCalls[0].loadReferenceDocuments?.()) ?? [];

describe("createDocument references", () => {
  it("reads a saved document by id from the database instead of fetching it", async () => {
    const result = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID, FOREIGN_ID],
    });

    assert.deepStrictEqual(await loadedReferences(), [
      {
        url: STORAGE_URL,
        title: "agency-letter.pdf",
        text: "Saved letter text",
        saved: "project",
      },
    ]);
    assert.deepStrictEqual(exaCalls, []);
    assert.deepStrictEqual(referencesOf(result), {
      used: ["agency-letter.pdf"],
      skipped: [],
      unresolved: 1,
    });
  });

  it("maps our own storage URL to the saved document instead of fetching it", async () => {
    await runCreateDocument({ referenceUrls: [STORAGE_URL] });

    assert.deepStrictEqual(
      (await loadedReferences()).map(({ title }) => title),
      ["agency-letter.pdf"],
    );
    assert.deepStrictEqual(exaCalls, []);
  });

  it("never sends a storage URL to Exa, even when it matches no saved document", async () => {
    projectRows = [];

    const result = await runCreateDocument({
      referenceUrls: [`${STORAGE_BASE}/uploads/other/letter.pdf`, WEB_URL],
    });

    await loadedReferences();
    assert.deepStrictEqual(exaCalls, [[WEB_URL]]);
    assert.deepStrictEqual(referencesOf(result), {
      used: [],
      skipped: [],
      unresolved: 1,
    });
  });

  it("caps storage URLs at two and sends none to Exa", async () => {
    const thirdRow: ProjectDocumentExtraction = {
      ...savedRow,
      id: THIRD_ID,
      url: `${STORAGE_BASE}/uploads/user/third.pdf`,
      originalFilename: "third.pdf",
    };
    projectRows = [savedRow, pendingRow, thirdRow];

    const result = await runCreateDocument({
      referenceUrls: [savedRow.url, pendingRow.url, thirdRow.url],
    });

    await loadedReferences();
    assert.deepStrictEqual(exaCalls, []);
    assert.deepStrictEqual(referencesOf(result), {
      used: ["agency-letter.pdf"],
      skipped: [{ filename: "draft.pdf", reason: "extraction-pending" }],
      unresolved: 1,
    });
  });

  it("gives a non-text kind no loader and no references, without any lookup", async () => {
    const result = await runCreateDocument({
      kind: "tasks",
      referenceDocumentIds: [DOCUMENT_ID],
      referenceUrls: [STORAGE_URL, WEB_URL],
    });

    assert.strictEqual(handlerCalls[0].loadReferenceDocuments, undefined);
    assert.strictEqual(referencesOf(result), undefined);
    assert.deepStrictEqual(queryCalls, []);
    assert.deepStrictEqual(timingEvents, []);
    assert.deepStrictEqual(exaCalls, []);
  });

  it("reports which saved references were used and which are still being read", async () => {
    projectRows = [savedRow, pendingRow];

    const result = await runCreateDocument({
      referenceDocumentIds: [PENDING_ID, DOCUMENT_ID],
    });

    assert.deepStrictEqual(referencesOf(result), {
      used: ["agency-letter.pdf"],
      skipped: [{ filename: "draft.pdf", reason: "extraction-pending" }],
    });
    assert.deepStrictEqual(
      (await loadedReferences()).map(({ title }) => title),
      ["agency-letter.pdf"],
    );
  });

  it("reports a stored file whose extraction failed as having no text", async () => {
    projectRows = [{ ...pendingRow, extractionStatus: "failed" }];

    const result = await runCreateDocument({
      referenceDocumentIds: [PENDING_ID],
    });

    assert.deepStrictEqual(referencesOf(result), {
      used: [],
      skipped: [{ filename: "draft.pdf", reason: "no-text" }],
    });
    assert.strictEqual(handlerCalls[0].loadReferenceDocuments, undefined);
  });

  it("reads a saved research link from its public page", async () => {
    projectRows = [linkRow];

    const result = await runCreateDocument({ referenceDocumentIds: [LINK_ID] });

    assert.deepStrictEqual(
      (await loadedReferences()).map(({ url }) => url),
      [linkRow.url],
    );
    assert.deepStrictEqual(exaCalls, [[linkRow.url]]);
    assert.deepStrictEqual(referencesOf(result), {
      used: ["Agency project page"],
      skipped: [],
    });
  });

  it("drops another project's document by id and keeps the web path", async () => {
    projectRows = [savedRow, foreignRow];

    const result = await runCreateDocument({
      referenceDocumentIds: [FOREIGN_ID],
      referenceUrls: [WEB_URL],
    });

    // The unscoped id lookup returns the foreign row; it is filtered out.
    assert.ok(queryCalls.includes("project-texts"));
    assert.deepStrictEqual(
      (await loadedReferences()).map(({ url }) => url),
      [WEB_URL],
    );
    assert.deepStrictEqual(exaCalls, [[WEB_URL]]);
    assert.deepStrictEqual(referencesOf(result), {
      used: [],
      skipped: [],
      unresolved: 1,
    });
  });

  it("logs reference loading timing", async () => {
    await runCreateDocument({ referenceDocumentIds: [DOCUMENT_ID] });

    assert.deepStrictEqual(
      timingEvents.map(({ message }) => message),
      ["[ChatTiming] references-loaded", "[ChatTiming] letterhead-copied"],
    );
    assert.deepStrictEqual(Object.keys(timingEvents[0]).sort(), [
      "chatId",
      "elapsedMs",
      "message",
      "requestedIds",
      "requestedUrls",
      "savedCount",
      "savedTextCount",
      "unresolvedCount",
      "webUrlCount",
    ]);
    assert.strictEqual(typeof timingEvents[0].elapsedMs, "number");
    assert.strictEqual(timingEvents[0].requestedIds, 1);
    assert.strictEqual(timingEvents[0].savedCount, 1);
    assert.strictEqual(timingEvents[0].savedTextCount, 1);
    assert.strictEqual(timingEvents[0].unresolvedCount, 0);
  });

  it("does nothing new without references", async () => {
    const result = await runCreateDocument({});

    assert.deepStrictEqual(timingEvents, []);
    assert.strictEqual(handlerCalls[0].loadReferenceDocuments, undefined);
    assert.ok(!("references" in (result as object)));
  });
});

describe("createDocument letterhead", () => {
  const copy = {
    layout: "grid",
    nameLines: ["Bureau of Land Management"],
    contactLines: ["1 Main St"],
    color: null,
  };
  const library = {
    layout: "split",
    nameLines: ["Partner Agency"],
    contactLines: [],
    color: null,
  };
  const office = {
    layout: "split",
    nameLines: ["Example Ranger District"],
    contactLines: [],
    color: null,
  };
  const LIBRARY_ID = "00000000-0000-4000-8000-0000000000f1";

  const letterheadFromOf = (result: unknown) =>
    (result as { letterheadFrom?: unknown }).letterheadFrom;

  const letterheadNotesOf = (result: unknown) =>
    (
      result as {
        letterheadNotes?: { filename: string; reason: string; note: string }[];
      }
    ).letterheadNotes;

  const copiedReferences = () =>
    copyReferenceLetterhead.mock.calls[0]?.arguments[0].references;

  it("gives a document modeled on a saved reference that reference's letterhead", async () => {
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    const result = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
    });

    assert.deepStrictEqual(handlerCalls[0].letterhead, copy);
    assert.strictEqual(letterheadFromOf(result), "agency-letter.pdf");
    assert.strictEqual(letterheadNotesOf(result), undefined);
    assert.strictEqual(chooseDocumentLetterhead.mock.callCount(), 0);
    const [args] = copyReferenceLetterhead.mock.calls[0].arguments;
    assert.strictEqual(args.projectId, PROJECT_ID);
    assert.strictEqual(args.organizationId, ORGANIZATION_ID);
    assert.strictEqual(args.documentId, (result as { id: string }).id);
    assert.strictEqual(args.userId, USER_ID);
    assert.strictEqual(args.select, true);
    assert.deepStrictEqual(args.references, [
      { kind: "project", id: DOCUMENT_ID, source: "upload" },
    ]);
  });

  it("copies from a saved document named by its storage URL", async () => {
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    const result = await runCreateDocument({ referenceUrls: [STORAGE_URL] });

    assert.deepStrictEqual(handlerCalls[0].letterhead, copy);
    assert.strictEqual(letterheadFromOf(result), "agency-letter.pdf");
    assert.deepStrictEqual(copiedReferences(), [
      { kind: "project", id: DOCUMENT_ID, source: "upload" },
    ]);
  });

  it("passes a reference without text yet to the copy: its letterhead may be read", async () => {
    projectRows = [savedRow, pendingRow];

    await runCreateDocument({
      referenceDocumentIds: [PENDING_ID, DOCUMENT_ID],
    });

    assert.deepStrictEqual(copiedReferences(), [
      { kind: "project", id: PENDING_ID, source: "upload" },
      { kind: "project", id: DOCUMENT_ID, source: "upload" },
    ]);
  });

  it("never passes a reference past the cap to the copy", async () => {
    const thirdRow: ProjectDocumentExtraction = {
      ...savedRow,
      id: THIRD_ID,
      url: `${STORAGE_BASE}/uploads/user/third.pdf`,
      originalFilename: "third.pdf",
    };
    const fourthRow: ProjectDocumentExtraction = {
      ...savedRow,
      id: "00000000-0000-4000-8000-0000000000d5",
      url: `${STORAGE_BASE}/uploads/user/fourth.pdf`,
      originalFilename: "fourth.pdf",
    };
    projectRows = [savedRow, thirdRow, fourthRow];

    const result = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID, THIRD_ID],
      referenceUrls: [fourthRow.url],
    });

    assert.deepStrictEqual(copiedReferences(), [
      { kind: "project", id: DOCUMENT_ID, source: "upload" },
      { kind: "project", id: THIRD_ID, source: "upload" },
    ]);
    assert.strictEqual(
      (referencesOf(result) as { unresolved?: number }).unresolved,
      1,
    );
  });

  it("starts the copy only once the model's letterhead choice has settled", async () => {
    let settleChoice: () => void = () => {};
    const choiceSettled = new Promise<void>((resolve) => {
      settleChoice = resolve;
    });
    chooseDocumentLetterhead.mock.mockImplementationOnce(async () => {
      await choiceSettled;
      return { selection: "none", letterhead: null };
    });
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    const run = runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
      letterheadId: "none",
    });
    // Let the reference lookup finish while the choice is still pending.
    for (let tick = 0; tick < 20; tick += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(queryCalls.includes("project-texts"));
    assert.strictEqual(chooseDocumentLetterhead.mock.callCount(), 1);
    assert.strictEqual(copyReferenceLetterhead.mock.callCount(), 0);

    settleChoice();
    const result = await run;

    assert.strictEqual(copyReferenceLetterhead.mock.callCount(), 1);
    assert.deepStrictEqual(handlerCalls[0].letterhead, copy);
    assert.strictEqual(letterheadFromOf(result), "agency-letter.pdf");
  });

  it("keeps a library letterhead the model named over the reference's", async () => {
    chosenLetterhead = { selection: LIBRARY_ID, letterhead: library };
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    const result = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
      letterheadId: LIBRARY_ID,
    });

    assert.deepStrictEqual(handlerCalls[0].letterhead, library);
    assert.strictEqual(letterheadFromOf(result), undefined);
    assert.strictEqual(letterheadNotesOf(result), undefined);
    // The copy is still stored, unselected, for the Letterhead menu.
    assert.strictEqual(copyReferenceLetterhead.mock.callCount(), 1);
    const [args] = copyReferenceLetterhead.mock.calls[0].arguments;
    assert.strictEqual(args.select, false);
  });

  for (const letterheadId of ["default", "none"]) {
    it(`does not let the model's "${letterheadId}" override the reference's letterhead`, async () => {
      chosenLetterhead = {
        selection: letterheadId,
        letterhead: letterheadId === "none" ? null : office,
      };
      copiedLetterhead = {
        letterhead: copy,
        referenceFilename: "agency-letter.pdf",
      };

      const result = await runCreateDocument({
        referenceDocumentIds: [DOCUMENT_ID],
        letterheadId,
      });

      assert.deepStrictEqual(handlerCalls[0].letterhead, copy);
      assert.strictEqual(letterheadFromOf(result), "agency-letter.pdf");
    });
  }

  it("copies the reference's letterhead when the model's library id is not honored", async () => {
    // An id outside the organization falls back to the default.
    chosenLetterhead = { selection: "default", letterhead: office };
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
      letterheadId: LIBRARY_ID,
    });

    assert.deepStrictEqual(handlerCalls[0].letterhead, copy);
    const [args] = copyReferenceLetterhead.mock.calls[0].arguments;
    assert.strictEqual(args.select, true);
  });

  it("keeps today's letterhead when no reference has an analyzed letterhead", async () => {
    chosenLetterhead = { selection: "none", letterhead: null };

    const chosen = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
      letterheadId: "none",
    });
    assert.strictEqual(handlerCalls[0].letterhead, null);
    assert.strictEqual(letterheadFromOf(chosen), undefined);

    const unchosen = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
    });
    // No choice: the handler resolves the default itself, as before.
    assert.strictEqual(handlerCalls[1].letterhead, undefined);
    assert.ok(!("letterheadFrom" in (unchosen as object)));
    assert.strictEqual(copyReferenceLetterhead.mock.callCount(), 2);
  });

  it("does not look for a reference letterhead without saved references", async () => {
    chosenLetterhead = { selection: "default", letterhead: office };

    await runCreateDocument({
      referenceUrls: [WEB_URL],
      letterheadId: "default",
    });
    await runCreateDocument({
      kind: "tasks",
      referenceDocumentIds: [DOCUMENT_ID],
    });

    assert.strictEqual(copyReferenceLetterhead.mock.callCount(), 0);
    assert.deepStrictEqual(handlerCalls[0].letterhead, office);
  });

  it("models on a research document as another project's and only offers its letterhead", async () => {
    projectRows = [researchRow];
    // The real copy stores a research reference's letterhead unselected.
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "analog-letter.pdf",
      selected: false,
    };

    const result = await runCreateDocument({
      referenceDocumentIds: [RESEARCH_ID],
    });

    assert.deepStrictEqual(
      (await loadedReferences()).map(({ title, saved }) => ({ title, saved })),
      [{ title: "analog-letter.pdf", saved: "research" }],
    );
    assert.deepStrictEqual(referencesOf(result), {
      used: ["analog-letter.pdf"],
      skipped: [],
    });
    const [args] = copyReferenceLetterhead.mock.calls[0].arguments;
    assert.deepStrictEqual(args.references, [
      { kind: "project", id: RESEARCH_ID, source: "research" },
    ]);
    // The document keeps the default: the handler resolves it.
    assert.strictEqual(handlerCalls[0].letterhead, undefined);
    assert.ok(!("letterheadFrom" in (result as object)));
    const notes = letterheadNotesOf(result);
    assert.deepStrictEqual(
      notes?.map(({ filename, reason }) => ({ filename, reason })),
      [{ filename: "analog-letter.pdf", reason: "letterhead-offered" }],
    );
    assert.match(notes?.[0].note ?? "", /letterhead was NOT applied/);
    assert.match(
      notes?.[0].note ?? "",
      /available in the document's Letterhead menu as "From analog-letter\.pdf"/,
    );
    assert.match(notes?.[0].note ?? "", /Never say the document carries/);
  });

  it("keeps the model's default letterhead under a research reference's offered copy", async () => {
    projectRows = [researchRow];
    chosenLetterhead = { selection: "default", letterhead: office };
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "analog-letter.pdf",
      selected: false,
    };

    const result = await runCreateDocument({
      referenceDocumentIds: [RESEARCH_ID],
      letterheadId: "default",
    });

    assert.deepStrictEqual(handlerCalls[0].letterhead, office);
    assert.strictEqual(letterheadFromOf(result), undefined);
    assert.strictEqual(
      letterheadNotesOf(result)?.[0].reason,
      "letterhead-offered",
    );
  });

  it("tells the assistant when a reference's letterhead is still being read", async () => {
    pendingLetterheads = ["agency-letter.pdf"];

    const result = await runCreateDocument({
      referenceDocumentIds: [DOCUMENT_ID],
    });

    assert.strictEqual(handlerCalls[0].letterhead, undefined);
    assert.ok(!("letterheadFrom" in (result as object)));
    // The text was used; only the letterhead is still to come.
    assert.deepStrictEqual(referencesOf(result), {
      used: ["agency-letter.pdf"],
      skipped: [],
    });
    const notes = letterheadNotesOf(result);
    assert.deepStrictEqual(
      notes?.map(({ filename, reason }) => ({ filename, reason })),
      [{ filename: "agency-letter.pdf", reason: "letterhead-pending" }],
    );
    assert.match(notes?.[0].note ?? "", /still being read/);
    assert.match(notes?.[0].note ?? "", /ask again in a minute to apply it/);
    assert.match(notes?.[0].note ?? "", /call createDocument again/);
  });

  it("reports a pending letterhead next to the one the document carries", async () => {
    projectRows = [savedRow, pendingRow];
    pendingLetterheads = ["draft.pdf"];
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    const result = await runCreateDocument({
      referenceDocumentIds: [PENDING_ID, DOCUMENT_ID],
    });

    assert.strictEqual(letterheadFromOf(result), "agency-letter.pdf");
    assert.deepStrictEqual(
      letterheadNotesOf(result)?.map(({ filename, reason }) => ({
        filename,
        reason,
      })),
      [{ filename: "draft.pdf", reason: "letterhead-pending" }],
    );
  });

  it("logs whether the letterhead was copied, without any text", async () => {
    copiedLetterhead = {
      letterhead: copy,
      referenceFilename: "agency-letter.pdf",
    };

    await runCreateDocument({ referenceDocumentIds: [DOCUMENT_ID] });

    const event = timingEvents.find(
      ({ message }) => message === "[ChatTiming] letterhead-copied",
    );
    assert.ok(event);
    assert.deepStrictEqual(Object.keys(event).sort(), [
      "chatId",
      "copied",
      "elapsedMs",
      "message",
      "pendingCount",
      "select",
      "selected",
    ]);
    assert.strictEqual(event.copied, true);
    assert.strictEqual(event.select, true);
    assert.strictEqual(event.selected, true);
    assert.strictEqual(event.pendingCount, 0);
    assert.strictEqual(typeof event.elapsedMs, "number");
  });
});
