import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

import type {
  OrganizationDocumentLetterheadAnalysis,
  ProjectDocumentLetterheadAnalysis,
} from "@wildfires-org/turboplan-db/queries";

import type { GridLetterhead } from "../src/letterhead-grid";

const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const OTHER_PROJECT_ID = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const ORG_DOC_ID = "33333333-3333-4333-8333-333333333333";

const gridOf = (name: string): GridLetterhead => ({
  cells: [
    {
      kind: "text",
      x: 0,
      width: 0.6,
      align: "left",
      lines: [
        { text: name, bold: true, size: "large" },
        { text: "1 Main St", bold: false, size: "small" },
      ],
    },
  ],
  color: "#1F5F3A",
});

const analysis = (
  id: string,
  overrides: Partial<ProjectDocumentLetterheadAnalysis> = {},
): ProjectDocumentLetterheadAnalysis => ({
  id,
  originalFilename: `${id}.pdf`,
  letterheadStatus: "done",
  letterheadAnalysis: { hasLetterhead: true, grid: gridOf(id) },
  ...overrides,
});

const createDeferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

// The real query module, with the reads and the two writes stubbed. Writes
// are recorded in order, so the tests can check the copy lands first.
const actualQueries = await import("@wildfires-org/turboplan-db/queries");
let projectAnalyses: ProjectDocumentLetterheadAnalysis[] = [];
let organizationAnalyses: OrganizationDocumentLetterheadAnalysis[] = [];
let documentProjectId: string | null = null;
const writes: string[] = [];
const getProjectIdByDocumentId = mock.fn(
  async (_args: { id: string }) => documentProjectId,
);
const getProjectDocumentLetterheadAnalyses = mock.fn(
  async (_projectId: string, ids: string[]) =>
    projectAnalyses.filter((row) => ids.includes(row.id)),
);
const getOrganizationDocumentLetterheadAnalyses = mock.fn(
  async (_organizationId: string, ids: string[]) =>
    organizationAnalyses.filter((row) => ids.includes(row.id)),
);
const upsertDocumentOwnLetterhead = mock.fn(async (_values: unknown) => {
  writes.push("copy");
});
const upsertDocumentLetterheadSelection = mock.fn(async (_values: unknown) => {
  writes.push("selection");
});

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    ...actualQueries,
    getProjectIdByDocumentId,
    getProjectDocumentLetterheadAnalyses,
    getOrganizationDocumentLetterheadAnalyses,
    upsertDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
  },
});

const { copyReferenceLetterhead } = await import(
  "../src/server/projects/reference-letterhead"
);

const copy = (
  references: Parameters<typeof copyReferenceLetterhead>[0]["references"],
  {
    organizationId = ORGANIZATION_ID,
    select,
  }: { organizationId?: string | null; select?: boolean } = {},
) =>
  copyReferenceLetterhead({
    projectId: PROJECT_ID,
    organizationId,
    documentId: DOCUMENT_ID,
    references,
    userId: USER_ID,
    ...(select === undefined ? {} : { select }),
  });

const projectReference = (id: string) => ({ kind: "project" as const, id });

const researchReference = (id: string) => ({
  kind: "project" as const,
  id,
  source: "research" as const,
});

const NOTHING_COPIED = { copied: null, pendingFilenames: [] };

const withSilencedConsole = async <T>(
  method: "error" | "warn",
  run: () => Promise<T>,
): Promise<{ result: T; logged: unknown[][] }> => {
  const logged: unknown[][] = [];
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    return { result: await run(), logged };
  } finally {
    console[method] = original;
  }
};

beforeEach(() => {
  projectAnalyses = [];
  organizationAnalyses = [];
  documentProjectId = null;
  writes.length = 0;
  for (const fn of [
    getProjectIdByDocumentId,
    getProjectDocumentLetterheadAnalyses,
    getOrganizationDocumentLetterheadAnalyses,
    upsertDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
  ]) {
    fn.mock.resetCalls();
  }
});

describe("copyReferenceLetterhead", () => {
  it("copies the first analyzed reference in the given order and selects it", async () => {
    projectAnalyses = [analysis(FIRST_ID), analysis(SECOND_ID)];

    const { copied, pendingFilenames } = await copy([
      projectReference(SECOND_ID),
      projectReference(FIRST_ID),
    ]);

    assert.equal(copied?.referenceFilename, `${SECOND_ID}.pdf`);
    assert.equal(copied?.selected, true);
    assert.deepEqual(pendingFilenames, []);
    assert.equal(copied?.letterhead.layout, "grid");
    assert.deepEqual(copied?.letterhead.nameLines, [SECOND_ID]);
    assert.deepEqual(copied?.letterhead.contactLines, ["1 Main St"]);
    assert.equal(copied?.letterhead.color, "#1f5f3a");
    assert.deepEqual(
      getProjectDocumentLetterheadAnalyses.mock.calls[0].arguments,
      [PROJECT_ID, [SECOND_ID, FIRST_ID]],
    );
    assert.deepEqual(getProjectIdByDocumentId.mock.calls[0].arguments, [
      { id: DOCUMENT_ID },
    ]);
    assert.deepEqual(upsertDocumentOwnLetterhead.mock.calls[0].arguments, [
      {
        documentId: DOCUMENT_ID,
        letterhead: gridOf(SECOND_ID),
        referenceFilename: `${SECOND_ID}.pdf`,
        referenceProjectDocumentId: SECOND_ID,
        updatedBy: USER_ID,
      },
    ]);
    assert.deepEqual(
      upsertDocumentLetterheadSelection.mock.calls[0].arguments,
      [
        {
          documentId: DOCUMENT_ID,
          letterheadId: null,
          useOwn: true,
          updatedBy: USER_ID,
        },
      ],
    );
    assert.deepEqual(writes, ["copy", "selection"]);
  });

  it("copies the reference's base text size into the document's copy", async () => {
    projectAnalyses = [
      analysis(FIRST_ID, {
        letterheadAnalysis: {
          hasLetterhead: true,
          grid: { ...gridOf(FIRST_ID), fontSize: 0.0123 },
        },
      }),
    ];

    const { copied } = await copy([projectReference(FIRST_ID)]);

    const [values] = upsertDocumentOwnLetterhead.mock.calls[0].arguments as [
      { letterhead: GridLetterhead },
    ];
    assert.equal(values.letterhead.fontSize, 0.0123);
    assert.equal(
      copied?.letterhead.layout === "grid" && copied.letterhead.grid.fontSize,
      0.0123,
    );
  });

  it("writes the selection only after the copy has landed", async () => {
    projectAnalyses = [analysis(FIRST_ID)];
    const copyWrite = createDeferred();
    upsertDocumentOwnLetterhead.mock.mockImplementationOnce(async () => {
      await copyWrite.promise;
      writes.push("copy");
    });

    const pending = copy([projectReference(FIRST_ID)]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(upsertDocumentOwnLetterhead.mock.callCount(), 1);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);

    copyWrite.resolve();
    assert.ok((await pending).copied);
    assert.deepEqual(writes, ["copy", "selection"]);
  });

  it("stores the copy without selecting it when told not to", async () => {
    projectAnalyses = [analysis(FIRST_ID)];

    const { copied } = await copy([projectReference(FIRST_ID)], {
      select: false,
    });

    assert.equal(copied?.referenceFilename, `${FIRST_ID}.pdf`);
    assert.equal(copied?.selected, false);
    assert.deepEqual(writes, ["copy"]);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
  });

  it("stores a research document's letterhead without selecting it", async () => {
    projectAnalyses = [analysis(FIRST_ID)];

    const { copied, pendingFilenames } = await copy([
      researchReference(FIRST_ID),
    ]);

    assert.equal(copied?.referenceFilename, `${FIRST_ID}.pdf`);
    assert.equal(copied?.selected, false);
    assert.deepEqual(pendingFilenames, []);
    assert.deepEqual(upsertDocumentOwnLetterhead.mock.calls[0].arguments, [
      {
        documentId: DOCUMENT_ID,
        letterhead: gridOf(FIRST_ID),
        referenceFilename: `${FIRST_ID}.pdf`,
        referenceProjectDocumentId: FIRST_ID,
        updatedBy: USER_ID,
      },
    ]);
    assert.deepEqual(writes, ["copy"]);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
  });

  it("selects an uploaded document's letterhead", async () => {
    projectAnalyses = [analysis(FIRST_ID)];

    const { copied } = await copy([
      { ...projectReference(FIRST_ID), source: "upload" as const },
    ]);

    assert.equal(copied?.selected, true);
    assert.deepEqual(writes, ["copy", "selection"]);
  });

  it("tries an uploaded reference before a research document listed first", async () => {
    projectAnalyses = [analysis(FIRST_ID), analysis(SECOND_ID)];

    const { copied } = await copy([
      researchReference(FIRST_ID),
      projectReference(SECOND_ID),
    ]);

    assert.equal(copied?.referenceFilename, `${SECOND_ID}.pdf`);
    assert.equal(copied?.selected, true);
    assert.deepEqual(writes, ["copy", "selection"]);
  });

  it("reports a pending reference whose copy would be selected, then copies the next one", async () => {
    projectAnalyses = [
      analysis(FIRST_ID, {
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
      analysis(SECOND_ID),
    ];

    const { copied, pendingFilenames } = await copy([
      projectReference(FIRST_ID),
      projectReference(SECOND_ID),
    ]);

    assert.equal(copied?.referenceFilename, `${SECOND_ID}.pdf`);
    assert.deepEqual(pendingFilenames, [`${FIRST_ID}.pdf`]);
  });

  it("reports every pending reference when nothing could be copied", async () => {
    organizationAnalyses = [
      analysis(ORG_DOC_ID, {
        originalFilename: "agency-letter.pdf",
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
    ];
    projectAnalyses = [
      analysis(FIRST_ID, {
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
    ];

    const result = await copy([
      projectReference(FIRST_ID),
      { kind: "organization", id: ORG_DOC_ID },
    ]);

    assert.deepEqual(result, {
      copied: null,
      pendingFilenames: [`${FIRST_ID}.pdf`, "agency-letter.pdf"],
    });
    assert.deepEqual(writes, []);
  });

  it("does not report a pending reference whose copy would only be offered", async () => {
    projectAnalyses = [
      analysis(FIRST_ID, {
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
      analysis(SECOND_ID, {
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
    ];

    // A research document's, and any under a library letterhead (select: false).
    assert.deepEqual(await copy([researchReference(FIRST_ID)]), NOTHING_COPIED);
    assert.deepEqual(
      await copy([projectReference(SECOND_ID)], { select: false }),
      NOTHING_COPIED,
    );
  });

  it("stores the filename read with the analysis, not one the caller names", async () => {
    projectAnalyses = [
      analysis(FIRST_ID, { originalFilename: "scoping-letter.pdf" }),
    ];

    // A caller's own reference type may carry a filename; it is never stored.
    const reference = {
      ...projectReference(FIRST_ID),
      filename: "renamed-by-caller.pdf",
    };
    const { copied } = await copy([reference]);

    assert.equal(copied?.referenceFilename, "scoping-letter.pdf");
    const [values] = upsertDocumentOwnLetterhead.mock.calls[0].arguments as [
      { referenceFilename: string },
    ];
    assert.equal(values.referenceFilename, "scoping-letter.pdf");
  });

  it("skips references whose analysis is not done or whose grid is invalid", async () => {
    const pending = "44444444-4444-4444-8444-444444444444";
    const none = "55555555-5555-4555-8555-555555555555";
    const invalid = "66666666-6666-4666-8666-666666666666";
    projectAnalyses = [
      analysis(pending, {
        letterheadStatus: "pending",
        letterheadAnalysis: null,
      }),
      analysis(none, {
        letterheadStatus: "none",
        letterheadAnalysis: { hasLetterhead: false, grid: null },
      }),
      analysis(invalid, {
        letterheadAnalysis: {
          hasLetterhead: true,
          grid: { cells: [], color: null },
        },
      }),
      analysis(FIRST_ID),
    ];

    const {
      result: { copied, pendingFilenames },
      logged,
    } = await withSilencedConsole("warn", () =>
      copy([
        projectReference(pending),
        projectReference(none),
        projectReference(invalid),
        projectReference(FIRST_ID),
      ]),
    );

    assert.equal(copied?.referenceFilename, `${FIRST_ID}.pdf`);
    // Only the analysis still to run is reported: "none" is final.
    assert.deepEqual(pendingFilenames, [`${pending}.pdf`]);
    assert.equal(upsertDocumentOwnLetterhead.mock.callCount(), 1);
    // Only the "done" analysis whose grid does not render is logged, by id.
    assert.deepEqual(logged, [
      [
        "[letterhead] Analyzed reference has no usable letterhead grid:",
        invalid,
      ],
    ]);
  });

  it("stores an organization reference's id as the organization reference", async () => {
    organizationAnalyses = [
      analysis(ORG_DOC_ID, { originalFilename: "agency-letter.pdf" }),
    ];

    const { copied } = await copy([{ kind: "organization", id: ORG_DOC_ID }]);

    assert.equal(copied?.referenceFilename, "agency-letter.pdf");
    assert.equal(copied?.selected, true);
    assert.deepEqual(
      getOrganizationDocumentLetterheadAnalyses.mock.calls[0].arguments,
      [ORGANIZATION_ID, [ORG_DOC_ID]],
    );
    assert.deepEqual(upsertDocumentOwnLetterhead.mock.calls[0].arguments, [
      {
        documentId: DOCUMENT_ID,
        letterhead: gridOf(ORG_DOC_ID),
        referenceFilename: "agency-letter.pdf",
        referenceOrganizationDocumentId: ORG_DOC_ID,
        updatedBy: USER_ID,
      },
    ]);
  });

  it("never matches a project reference against the organization's analyses", async () => {
    organizationAnalyses = [analysis(ORG_DOC_ID)];

    assert.deepEqual(
      await copy([projectReference(ORG_DOC_ID)]),
      NOTHING_COPIED,
    );
    assert.deepEqual(writes, []);
  });

  it("copies nothing and writes nothing for a reference outside the scoped result", async () => {
    // A foreign id: the scoped query does not return it.
    projectAnalyses = [];

    assert.deepEqual(await copy([projectReference(FIRST_ID)]), NOTHING_COPIED);
    assert.deepEqual(writes, []);
  });

  it("never reads organization references without an organization", async () => {
    organizationAnalyses = [analysis(ORG_DOC_ID)];

    const result = await copy([{ kind: "organization", id: ORG_DOC_ID }], {
      organizationId: null,
    });

    assert.deepEqual(result, NOTHING_COPIED);
    assert.equal(getOrganizationDocumentLetterheadAnalyses.mock.callCount(), 0);
    assert.deepEqual(writes, []);
  });

  it("never writes for a document of another project", async () => {
    projectAnalyses = [analysis(FIRST_ID)];
    documentProjectId = OTHER_PROJECT_ID;

    assert.deepEqual(await copy([projectReference(FIRST_ID)]), NOTHING_COPIED);
    assert.deepEqual(writes, []);
  });

  it("copies for an existing document of the same project", async () => {
    projectAnalyses = [analysis(FIRST_ID)];
    documentProjectId = PROJECT_ID;

    assert.ok((await copy([projectReference(FIRST_ID)])).copied);
    assert.deepEqual(writes, ["copy", "selection"]);
  });

  it("does nothing without references", async () => {
    assert.deepEqual(await copy([]), NOTHING_COPIED);
    assert.equal(getProjectIdByDocumentId.mock.callCount(), 0);
    assert.equal(getProjectDocumentLetterheadAnalyses.mock.callCount(), 0);
    assert.equal(getOrganizationDocumentLetterheadAnalyses.mock.callCount(), 0);
    assert.deepEqual(writes, []);
  });

  it("copies nothing and reports nothing pending when the analysis failed", async () => {
    projectAnalyses = [
      analysis(FIRST_ID, {
        letterheadStatus: "failed",
        letterheadAnalysis: null,
      }),
    ];

    assert.deepEqual(await copy([projectReference(FIRST_ID)]), NOTHING_COPIED);
    assert.deepEqual(writes, []);
  });

  it("copies nothing instead of throwing when a query fails", async () => {
    getProjectDocumentLetterheadAnalyses.mock.mockImplementationOnce(
      async () => {
        throw new Error("connection reset");
      },
    );

    const { result, logged } = await withSilencedConsole("error", () =>
      copy([projectReference(FIRST_ID)]),
    );

    assert.deepEqual(result, NOTHING_COPIED);
    assert.deepEqual(writes, []);
    // Only the error name is logged, never the message.
    assert.deepEqual(logged, [
      ["[letterhead] Reference letterhead copy failed:", "Error"],
    ]);
  });

  it("leaves the selection alone when the copy fails", async () => {
    projectAnalyses = [analysis(FIRST_ID)];
    upsertDocumentOwnLetterhead.mock.mockImplementationOnce(async () => {
      throw new Error("check violation");
    });

    const { result } = await withSilencedConsole("error", () =>
      copy([projectReference(FIRST_ID)]),
    );

    assert.deepEqual(result, NOTHING_COPIED);
    assert.equal(upsertDocumentOwnLetterhead.mock.callCount(), 1);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
    assert.deepEqual(writes, []);
  });

  it("reports no copy when the selection fails, keeping the stored copy", async () => {
    projectAnalyses = [analysis(FIRST_ID)];
    upsertDocumentLetterheadSelection.mock.mockImplementationOnce(async () => {
      throw new Error("check violation");
    });

    const { result } = await withSilencedConsole("error", () =>
      copy([projectReference(FIRST_ID)]),
    );

    assert.deepEqual(result, NOTHING_COPIED);
    assert.deepEqual(writes, ["copy"]);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 1);
  });
});
