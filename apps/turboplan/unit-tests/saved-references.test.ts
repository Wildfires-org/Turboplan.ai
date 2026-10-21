import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type {
  OrganizationDocumentText,
  ProjectDocumentExtraction,
} from "@wildfires-org/turboplan-db/queries";
import { resetEnvCache } from "@wildfires-org/turboplan-env";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";

import type * as SavedReferencesModule from "../lib/ai/saved-references";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_PROJECT_ID = "00000000-0000-4000-8000-0000000000a2";
const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000b1";
const USER_ID = "00000000-0000-4000-8000-0000000000c1";
const STORAGE_BASE = "https://files.example.test";
// R2_PUBLIC_URL lists two buckets in the web app (see next.config).
const SECOND_STORAGE_BASE = "https://images.example.test";
const WEB_URL = "https://example.gov/letter.pdf";

const docId = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

type OrganizationRow = OrganizationDocumentText;

let projectRows: ProjectDocumentExtraction[] = [];
let organizationRows: OrganizationRow[] = [];
let readAllowed: Record<string, boolean> = {};
let failLookup = false;
const projectTextCalls: string[][] = [];
const projectListCalls: string[] = [];
const organizationListCalls: string[] = [];
const organizationTextCalls: Array<{ organizationId: string; ids: string[] }> =
  [];
const permissionCalls: Array<[string, string, string]> = [];

// The project id lookup is unscoped (like readProjectDocuments), so the fake
// returns any project's rows; the listings and the organization text query
// are scoped, so their fakes stand for one project or organization.
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    getProjectDocumentExtractionByIds: async (ids: string[]) => {
      projectTextCalls.push(ids);
      if (failLookup) {
        throw new Error("connection reset");
      }
      return projectRows.filter((row) => ids.includes(row.id));
    },
    getProjectDocumentsByProjectId: async (projectId: string) => {
      projectListCalls.push(projectId);
      return projectRows.filter((row) => row.projectId === projectId);
    },
    listOrganizationDocuments: async (organizationId: string) => {
      organizationListCalls.push(organizationId);
      return organizationRows;
    },
    getOrganizationDocumentTextsByIds: async (
      organizationId: string,
      ids: string[],
    ) => {
      organizationTextCalls.push({ organizationId, ids });
      return organizationRows.filter((row) => ids.includes(row.id));
    },
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async (
        _userId: string,
        entityId: string,
        entityType: string,
        action: string,
      ) => {
        permissionCalls.push([entityId, entityType, action]);
        return { allowed: readAllowed[entityId] ?? true };
      },
    }),
  },
});

// The real storage host / canonical URL logic runs against R2_PUBLIC_URL.
// The turboplan app resolves as CJS, so import after the mocks are registered.
let savedReferences: typeof SavedReferencesModule;

before(async () => {
  process.env.R2_PUBLIC_URL = `${STORAGE_BASE}, ${SECOND_STORAGE_BASE}/`;
  resetEnvCache();
  savedReferences = await import("../lib/ai/saved-references");
});

beforeEach(() => {
  projectRows = [];
  organizationRows = [];
  readAllowed = {};
  failLookup = false;
  projectTextCalls.length = 0;
  projectListCalls.length = 0;
  organizationListCalls.length = 0;
  organizationTextCalls.length = 0;
  permissionCalls.length = 0;
});

const projectRow = (
  index: number,
  overrides: Partial<ProjectDocumentExtraction> = {},
): ProjectDocumentExtraction => ({
  id: docId(index),
  projectId: PROJECT_ID,
  url: `${STORAGE_BASE}/uploads/user/doc ${index}.pdf`,
  originalFilename: `doc-${index}.pdf`,
  mimeType: "application/pdf",
  source: "upload",
  extractionStatus: "done",
  extractedText: `Text of document ${index}`,
  extractionError: null,
  ...overrides,
});

const organizationRow = (index: number): OrganizationRow => ({
  id: docId(index),
  url: `${STORAGE_BASE}/organizations/org/doc ${index}.pdf`,
  originalFilename: `org-doc-${index}.pdf`,
  extractionStatus: "done",
  extractedText: `Text of organization document ${index}`,
});

const load = (
  overrides: Partial<Parameters<typeof savedReferences.loadSavedReferences>[0]>,
) =>
  savedReferences.loadSavedReferences({
    projectId: PROJECT_ID,
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    ...overrides,
  });

const recordingFetch = () => {
  const calls: string[][] = [];
  const fetchContents = async (urls: string[]) => {
    calls.push(urls);
    return {
      results: urls.map((url) => ({ url, title: "Web", text: `Web ${url}` })),
    };
  };
  return { calls, fetchContents };
};

const emptyCache = { remember: () => {}, get: () => undefined };

describe("loadSavedReferences", () => {
  it("reads saved documents by id from the database, READ-checked on the project and organization", async () => {
    projectRows = [projectRow(1)];

    const result = await load({ documentIds: [docId(1).toUpperCase()] });

    assert.deepStrictEqual(projectTextCalls, [[docId(1)]]);
    // Without storage URLs nothing is listed; the organization-scoped text
    // query is asked for the id too and just does not hold it.
    assert.deepStrictEqual(projectListCalls, []);
    assert.deepStrictEqual(organizationListCalls, []);
    assert.deepStrictEqual(organizationTextCalls, [
      { organizationId: ORGANIZATION_ID, ids: [docId(1)] },
    ]);
    assert.deepStrictEqual(
      [...permissionCalls].sort(([a], [b]) => a.localeCompare(b)),
      [
        [PROJECT_ID, EntityType.PROJECT, Action.READ],
        [ORGANIZATION_ID, EntityType.ORGANIZATION, Action.READ],
      ],
    );
    assert.deepStrictEqual(result, {
      references: [
        {
          kind: "project",
          id: docId(1),
          filename: "doc-1.pdf",
          url: `${STORAGE_BASE}/uploads/user/doc 1.pdf`,
          extractionStatus: "done",
          text: "Text of document 1",
          source: "upload",
        },
      ],
      webUrls: [],
      unresolved: 0,
    });
  });

  it("marks a project document the research agent saved, and only that one, as research", async () => {
    projectRows = [
      projectRow(1, { source: "research" }),
      projectRow(2),
      // An unknown origin is treated like an upload.
      projectRow(3, { source: "import" }),
    ];
    organizationRows = [organizationRow(4)];

    const result = await load({
      documentIds: [docId(1), docId(2), docId(3), docId(4)],
    });

    assert.deepStrictEqual(
      result.references.map(({ kind, source }) => ({ kind, source })),
      // At most two ids are looked up.
      [
        { kind: "project", source: "research" },
        { kind: "project", source: "upload" },
      ],
    );

    const rest = await load({ documentIds: [docId(3), docId(4)] });
    assert.deepStrictEqual(
      rest.references.map(({ kind, source }) => ({ kind, source })),
      [
        { kind: "project", source: "upload" },
        { kind: "organization", source: undefined },
      ],
    );
    assert.ok(!("source" in rest.references[1]));
  });

  it("reads an organization document by id with its stored URL, without listing the organization", async () => {
    organizationRows = [organizationRow(2)];

    const result = await load({ documentIds: [docId(2)] });

    assert.deepStrictEqual(organizationListCalls, []);
    assert.deepStrictEqual(organizationTextCalls, [
      { organizationId: ORGANIZATION_ID, ids: [docId(2)] },
    ]);
    assert.deepStrictEqual(result.references, [
      {
        kind: "organization",
        id: docId(2),
        filename: "org-doc-2.pdf",
        url: `${STORAGE_BASE}/organizations/org/doc 2.pdf`,
        extractionStatus: "done",
        text: "Text of organization document 2",
      },
    ]);
  });

  it("drops a document of another project", async () => {
    projectRows = [projectRow(1, { projectId: OTHER_PROJECT_ID })];

    const result = await load({ documentIds: [docId(1)] });

    assert.deepStrictEqual(result.references, []);
    assert.strictEqual(result.unresolved, 1);
  });

  it("drops invalid, unknown and extra ids, counting them as unresolved", async () => {
    projectRows = [projectRow(1)];

    const result = await load({
      documentIds: ["not-a-uuid", docId(9), docId(1), docId(2)],
    });

    // At most two ids are looked up; the unknown one just has no row.
    assert.deepStrictEqual(projectTextCalls, [[docId(9), docId(1)]]);
    assert.deepStrictEqual(
      result.references.map(({ id }) => id),
      [docId(1)],
    );
    assert.strictEqual(result.unresolved, 3);
  });

  it("does not query without ids or storage URLs", async () => {
    const result = await load({
      documentIds: ["not-a-uuid"],
      urls: [WEB_URL],
    });

    assert.deepStrictEqual(result, {
      references: [],
      webUrls: [WEB_URL],
      unresolved: 1,
    });
    assert.strictEqual(projectTextCalls.length, 0);
    assert.strictEqual(organizationListCalls.length, 0);
    assert.strictEqual(permissionCalls.length, 0);
  });

  it("does not query without a project, and still keeps storage URLs off the web path", async () => {
    const result = await load({
      projectId: undefined,
      urls: [`${STORAGE_BASE}/uploads/user/doc 1.pdf`, WEB_URL],
    });

    assert.deepStrictEqual(result, {
      references: [],
      webUrls: [WEB_URL],
      unresolved: 1,
    });
    assert.strictEqual(permissionCalls.length, 0);
  });

  it("maps a storage URL to its saved document and keeps web URLs on the web path", async () => {
    projectRows = [projectRow(1), projectRow(2)];
    // The model's copy differs from the stored URL in encoding and fragment.
    const storageUrl = `${STORAGE_BASE}/uploads/user/doc%201.pdf#page=2`;

    const result = await load({ urls: [storageUrl, WEB_URL] });

    assert.deepStrictEqual(projectListCalls, [PROJECT_ID]);
    assert.deepStrictEqual(projectTextCalls, [[docId(1)]]);
    assert.deepStrictEqual(
      result.references.map(({ id }) => id),
      [docId(1)],
    );
    assert.deepStrictEqual(result.webUrls, [WEB_URL]);
    assert.strictEqual(result.unresolved, 0);
  });

  it("maps a URL on the second R2_PUBLIC_URL base to its saved document", async () => {
    projectRows = [
      projectRow(1),
      projectRow(2, { url: `${SECOND_STORAGE_BASE}/generated/doc 2.pdf` }),
    ];

    const result = await load({
      urls: [`${SECOND_STORAGE_BASE}/generated/doc%202.pdf`],
    });

    assert.deepStrictEqual(
      result.references.map(({ id }) => id),
      [docId(2)],
    );
    assert.deepStrictEqual(result.webUrls, []);
  });

  it("keeps every URL on a storage host off the web path, even one that is not a canonical key", async () => {
    projectRows = [projectRow(1)];

    const result = await load({
      urls: [
        `http://files.example.test/uploads/user/doc 1.pdf`,
        `https://files.example.test./uploads/user/doc 1.pdf`,
        `${STORAGE_BASE}/uploads//doc 1.pdf`,
        `${STORAGE_BASE}/uploads/user/%zz.pdf`,
        `${SECOND_STORAGE_BASE.toUpperCase()}/uploads/x%2F..%2Fdoc 1.pdf`,
        WEB_URL,
      ],
    });

    assert.deepStrictEqual(result, {
      references: [],
      webUrls: [WEB_URL],
      unresolved: 5,
    });
    // None maps to an object, so nothing is looked up.
    assert.strictEqual(permissionCalls.length, 0);
  });

  it("maps a storage URL to an organization document with its stored URL", async () => {
    organizationRows = [organizationRow(2)];
    const storageUrl = `${STORAGE_BASE}/organizations/org/doc 2.pdf`;

    const result = await load({ urls: [storageUrl] });

    assert.deepStrictEqual(organizationListCalls, [ORGANIZATION_ID]);
    assert.deepStrictEqual(organizationTextCalls, [
      { organizationId: ORGANIZATION_ID, ids: [docId(2)] },
    ]);
    assert.deepStrictEqual(result.references, [
      {
        kind: "organization",
        id: docId(2),
        filename: "org-doc-2.pdf",
        url: storageUrl,
        extractionStatus: "done",
        text: "Text of organization document 2",
      },
    ]);
  });

  it("never sends a storage URL to the web path, even without stored text", async () => {
    projectRows = [
      projectRow(1, { extractionStatus: "pending", extractedText: null }),
    ];
    const storageUrl = `${STORAGE_BASE}/uploads/user/doc 1.pdf`;

    const result = await load({ urls: [storageUrl] });

    assert.strictEqual(result.references[0].text, null);
    assert.strictEqual(result.references[0].extractionStatus, "pending");
    assert.deepStrictEqual(result.webUrls, []);
  });

  it("caps storage URLs at two and sends none of them to the web path", async () => {
    projectRows = [projectRow(1), projectRow(2), projectRow(3)];

    const result = await load({
      urls: [1, 2, 3].map(
        (index) => `${STORAGE_BASE}/uploads/user/doc ${index}.pdf`,
      ),
    });

    assert.deepStrictEqual(
      result.references.map(({ id }) => id),
      [docId(1), docId(2)],
    );
    assert.deepStrictEqual(result.webUrls, []);
    assert.strictEqual(result.unresolved, 1);
  });

  it("drops a storage URL that matches no readable document", async () => {
    projectRows = [];
    const storageUrl = `${STORAGE_BASE}/uploads/other/doc.pdf`;

    const result = await load({ urls: [storageUrl, WEB_URL] });

    assert.deepStrictEqual(result, {
      references: [],
      webUrls: [WEB_URL],
      unresolved: 1,
    });
  });

  it("drops a storage URL of another project's document and keeps it off the web path", async () => {
    projectRows = [projectRow(1, { projectId: OTHER_PROJECT_ID })];
    const storageUrl = `${STORAGE_BASE}/uploads/user/doc 1.pdf`;

    const result = await load({ urls: [storageUrl, WEB_URL] });

    // This project's listing does not hold it, so its text is never read.
    assert.deepStrictEqual(projectListCalls, [PROJECT_ID]);
    assert.deepStrictEqual(projectTextCalls, []);
    assert.deepStrictEqual(result, {
      references: [],
      webUrls: [WEB_URL],
      unresolved: 1,
    });
  });

  it("drops organization documents without READ on the organization", async () => {
    projectRows = [projectRow(1)];
    organizationRows = [organizationRow(2)];
    readAllowed = { [ORGANIZATION_ID]: false };

    const result = await load({ documentIds: [docId(2), docId(1)] });

    assert.deepStrictEqual(organizationTextCalls, []);
    assert.deepStrictEqual(
      result.references.map(({ id, kind }) => ({ id, kind })),
      [{ id: docId(1), kind: "project" }],
    );
    assert.strictEqual(result.unresolved, 1);
  });

  it("drops project documents without READ on the project", async () => {
    projectRows = [projectRow(1)];
    readAllowed = { [PROJECT_ID]: false };

    const result = await load({ documentIds: [docId(1)] });

    assert.deepStrictEqual(projectTextCalls, []);
    assert.deepStrictEqual(result.references, []);
  });

  it("reads no organization documents when no organization is bound", async () => {
    projectRows = [projectRow(1)];

    const result = await load({
      organizationId: undefined,
      documentIds: [docId(1)],
    });

    assert.strictEqual(organizationListCalls.length, 0);
    assert.strictEqual(organizationTextCalls.length, 0);
    assert.deepStrictEqual(permissionCalls, [
      [PROJECT_ID, EntityType.PROJECT, Action.READ],
    ]);
    assert.strictEqual(result.references.length, 1);
  });

  it("lists a document once when named by id and by storage URL", async () => {
    projectRows = [projectRow(1)];

    const result = await load({
      documentIds: [docId(1)],
      urls: [`${STORAGE_BASE}/uploads/user/doc 1.pdf`],
    });

    assert.deepStrictEqual(
      result.references.map(({ id }) => id),
      [docId(1)],
    );
    assert.strictEqual(result.unresolved, 0);
  });

  it("keeps the request order: ids first, then URLs, each document once", async () => {
    projectRows = [projectRow(1), projectRow(3)];
    organizationRows = [organizationRow(2)];

    const result = await load({
      documentIds: [docId(2), docId(1)],
      urls: [
        `${STORAGE_BASE}/uploads/user/doc 3.pdf`,
        `${STORAGE_BASE}/uploads/user/doc 1.pdf`,
      ],
    });

    assert.deepStrictEqual(
      result.references.map(({ id, kind }) => `${kind}:${id}`),
      [
        `organization:${docId(2)}`,
        `project:${docId(1)}`,
        `project:${docId(3)}`,
      ],
    );
  });

  it("never throws: a failed lookup leaves only web URLs on the web path", async () => {
    failLookup = true;
    const originalError = console.error;
    console.error = () => {};
    try {
      const result = await load({
        documentIds: [docId(1)],
        urls: [`${STORAGE_BASE}/uploads/user/doc 1.pdf`, WEB_URL],
      });
      assert.deepStrictEqual(result, {
        references: [],
        webUrls: [WEB_URL],
        unresolved: 2,
      });
    } finally {
      console.error = originalError;
    }
  });
});

type Reference = SavedReferencesModule.SavedReference;

const savedReference = (
  index: number,
  overrides: Partial<Reference> = {},
): Reference => ({
  kind: "project",
  id: docId(index),
  filename: `doc-${index}.pdf`,
  url: `${STORAGE_BASE}/uploads/user/doc ${index}.pdf`,
  extractionStatus: "done",
  text: `Text ${index}`,
  ...overrides,
});

const withoutText = (
  index: number,
  extractionStatus: Reference["extractionStatus"],
  url?: string,
): Reference =>
  savedReference(index, {
    extractionStatus,
    text: null,
    ...(url ? { url } : {}),
  });

// A research "link only" document: a public page, never downloaded or read.
const researchLink = (index: number) =>
  withoutText(index, "unsupported", `https://agency.example.gov/page-${index}`);

describe("createReferenceLoader", () => {
  it("passes saved text, capped like web references, and fetches nothing", async () => {
    const { calls, fetchContents } = recordingFetch();
    const loader = savedReferences.createReferenceLoader({
      saved: {
        references: [savedReference(1, { text: "x".repeat(12_000) })],
        webUrls: [],
        unresolved: 0,
      },
      cache: emptyCache,
      fetchContents,
    });

    const documents = (await loader?.()) ?? [];

    assert.strictEqual(documents.length, 1);
    assert.strictEqual(documents[0].title, "doc-1.pdf");
    assert.strictEqual(documents[0].saved, "project");
    assert.ok(documents[0].text.startsWith("x".repeat(10_000)));
    assert.match(documents[0].text, /\[Reference text truncated here\.\]$/);
    assert.deepStrictEqual(calls, []);
  });

  it("frames a research document like a web reference and an upload as this project's", async () => {
    const { fetchContents } = recordingFetch();
    const loader = savedReferences.createReferenceLoader({
      saved: {
        references: [
          savedReference(1, { source: "research" }),
          savedReference(2, { source: "upload" }),
        ],
        webUrls: [],
        unresolved: 0,
      },
      cache: emptyCache,
      fetchContents,
    });

    const documents = (await loader?.()) ?? [];

    assert.deepStrictEqual(
      documents.map(({ title, saved }) => ({ title, saved })),
      [
        { title: "doc-1.pdf", saved: "research" },
        { title: "doc-2.pdf", saved: "project" },
      ],
    );
  });

  it("frames an organization document as the organization's", async () => {
    const { fetchContents } = recordingFetch();
    const loader = savedReferences.createReferenceLoader({
      saved: {
        references: [savedReference(1, { kind: "organization" })],
        webUrls: [],
        unresolved: 0,
      },
      cache: emptyCache,
      fetchContents,
    });

    const documents = (await loader?.()) ?? [];

    assert.strictEqual(documents[0].saved, "organization");
  });

  it("fills only the slots left by saved documents from the web", async () => {
    const { calls, fetchContents } = recordingFetch();
    const loader = savedReferences.createReferenceLoader({
      saved: {
        references: [savedReference(1)],
        webUrls: ["https://example.gov/a.pdf", "https://example.gov/b.pdf"],
        unresolved: 0,
      },
      cache: emptyCache,
      fetchContents,
    });

    const documents = (await loader?.()) ?? [];

    assert.deepStrictEqual(
      documents.map(({ title }) => title),
      ["doc-1.pdf", "Web"],
    );
    assert.deepStrictEqual(calls, [["https://example.gov/a.pdf"]]);
  });

  it("reads a saved public page without text from the web, but never a stored file", async () => {
    const { calls, fetchContents } = recordingFetch();
    const loader = savedReferences.createReferenceLoader({
      saved: {
        references: [
          withoutText(1, "failed"),
          researchLink(2),
          withoutText(3, "failed", "https://agency.example.gov/failed.pdf"),
        ],
        webUrls: [WEB_URL],
        unresolved: 0,
      },
      cache: emptyCache,
      fetchContents,
    });

    const documents = (await loader?.()) ?? [];

    // Saved pages come first and take both slots; the stored file is skipped.
    assert.deepStrictEqual(calls, [
      [
        "https://agency.example.gov/page-2",
        "https://agency.example.gov/failed.pdf",
      ],
    ]);
    assert.strictEqual(documents.length, 2);
  });

  it("skips a stored file without text", () => {
    const { fetchContents } = recordingFetch();
    assert.strictEqual(
      savedReferences.createReferenceLoader({
        saved: {
          references: [withoutText(1, "pending")],
          webUrls: [],
          unresolved: 0,
        },
        cache: emptyCache,
        fetchContents,
      }),
      undefined,
    );
  });

  it("returns no loader when there is nothing to read", () => {
    const { fetchContents } = recordingFetch();
    assert.strictEqual(
      savedReferences.createReferenceLoader({
        saved: { references: [], webUrls: [], unresolved: 1 },
        cache: emptyCache,
        fetchContents,
      }),
      undefined,
    );
  });
});

describe("reportSavedReferences", () => {
  it("lists the documents the generator gets, those it skips and those over the cap", () => {
    assert.deepStrictEqual(
      savedReferences.reportSavedReferences({
        references: [
          withoutText(1, "pending"),
          savedReference(2),
          savedReference(3),
          savedReference(4),
          withoutText(5, "failed"),
          withoutText(6, "unsupported"),
        ],
        webUrls: [],
        unresolved: 1,
      }),
      {
        // At most two references reach the generator.
        used: ["doc-2.pdf", "doc-3.pdf"],
        skipped: [
          { filename: "doc-1.pdf", reason: "extraction-pending" },
          { filename: "doc-5.pdf", reason: "no-text" },
          { filename: "doc-6.pdf", reason: "no-text" },
        ],
        // One requested but not found, one over the cap.
        unresolved: 2,
      },
    );
  });

  it("counts a saved public page read from the web as used", () => {
    assert.deepStrictEqual(
      savedReferences.reportSavedReferences({
        references: [researchLink(1)],
        webUrls: [],
        unresolved: 0,
      }),
      { used: ["doc-1.pdf"], skipped: [] },
    );
  });

  it("reports unresolved references even when none was found", () => {
    assert.deepStrictEqual(
      savedReferences.reportSavedReferences({
        references: [],
        webUrls: [WEB_URL],
        unresolved: 2,
      }),
      { used: [], skipped: [], unresolved: 2 },
    );
  });

  it("reports nothing without saved references", () => {
    assert.strictEqual(
      savedReferences.reportSavedReferences({
        references: [],
        webUrls: [WEB_URL],
        unresolved: 0,
      }),
      undefined,
    );
  });
});

describe("letterheadReferences", () => {
  it("keeps used and skipped references in request order, never those over the cap", () => {
    assert.deepStrictEqual(
      savedReferences
        .letterheadReferences({
          references: [
            withoutText(1, "pending"),
            savedReference(2),
            researchLink(3),
            savedReference(4),
            withoutText(5, "failed"),
          ],
          webUrls: [WEB_URL],
          unresolved: 1,
        })
        .map(({ filename }) => filename),
      // doc-4 is past the cap of two used references.
      ["doc-1.pdf", "doc-2.pdf", "doc-3.pdf", "doc-5.pdf"],
    );
  });
});
