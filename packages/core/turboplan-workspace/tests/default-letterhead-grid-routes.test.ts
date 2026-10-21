import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { Hono } from "hono";

import type { GridLetterhead } from "../src/letterhead-grid";

// Route-level tests of the office/organization default letterhead grid
// (`/:id/letterhead-grid…`) and of `/api/projects/:projectId/letterhead-target`:
// the RBAC guard, the db queries (with the compare-and-set of the real write),
// the project/office lookups and the credentialed storage read are stubbed;
// the routers, the service, the version token and the grid mapping are real.

const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
const OTHER_USER_ID = "0a7c9d2e-9999-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const OTHER_ORGANIZATION_ID = "0a7c9d2e-3334-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-4444-4c3b-8d2e-3f4a5b6c7d8e";
const SIBLING_OFFICE_ID = "0a7c9d2e-4445-4c3b-8d2e-3f4a5b6c7d8e";
const FOREIGN_OFFICE_ID = "0a7c9d2e-4446-4c3b-8d2e-3f4a5b6c7d8e";
const UNKNOWN_ID = "0a7c9d2e-0000-4c3b-8d2e-3f4a5b6c7d8e";
const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const SIBLING_PROJECT_ID = "0a7c9d2e-1112-4c3b-8d2e-3f4a5b6c7d8e";
const FOREIGN_PROJECT_ID = "0a7c9d2e-1113-4c3b-8d2e-3f4a5b6c7d8e";
const DELETED_PROJECT_ID = "0a7c9d2e-1114-4c3b-8d2e-3f4a5b6c7d8e";
const DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const SIBLING_DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8f";
const STORAGE_HOST = "files.example.test";
const STORAGE = `https://${STORAGE_HOST}`;
// A read-only alias of the same bucket (a second R2_PUBLIC_URL entry).
const ALIAS = "https://images.example.test";
// Stored grids hold object keys.
const REFERENCE_LOGO = "letterheads/project/ref/logo-0-abc.png";
const REFERENCE_SEAL = "letterheads/project/ref/logo-1-abc.png";
// The editor sends a new logo as its upload URL; it is stored by key.
const OWN_UPLOAD_KEY = `uploads/${USER_ID}/1700000000-logo.png`;
const OWN_UPLOAD = `${STORAGE}/${OWN_UPLOAD_KEY}`;
const OTHER_UPLOAD = `${STORAGE}/uploads/${OTHER_USER_ID}/1700000000-logo.png`;
const METADATA_URL = "http://169.254.169.254/latest/meta-data/logo.png";

// Upload URLs only count as the editing user's own under this storage write
// base; ownership reads all five R2 vars.
Object.assign(process.env, {
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_BUCKET_NAME: "test",
  R2_PUBLIC_URL: `${STORAGE},${ALIAS}`,
});

const logoCell = (key: string, x = 0) => ({
  kind: "logo" as const,
  x,
  width: 0.15,
  height: 0.15,
  key,
});

const textCell = (text: string, x = 0.2, width = 0.6) => ({
  kind: "text" as const,
  x,
  width,
  align: "left" as const,
  lines: [{ text, bold: true, size: "large" as const }],
});

// A reference's letterhead as a document's copy holds it: a seal on each
// side, stored right one first (the logo `index` follows x, not storage order).
const copyGrid: GridLetterhead = {
  cells: [
    logoCell(REFERENCE_SEAL, 0.85),
    logoCell(REFERENCE_LOGO),
    textCell("Bureau of Land Management"),
  ],
  color: "#1F5F3A",
};

const orgGrid: GridLetterhead = {
  cells: [logoCell(REFERENCE_LOGO), textCell("Example Consulting")],
  color: null,
};

// ---------------------------------------------------------------------------
// Stubbed state
// ---------------------------------------------------------------------------

type OwnerKind = "organization" | "office";
type Owner = { kind: OwnerKind; id: string };
const ownerKey = (owner: Owner) => `${owner.kind}:${owner.id}`;

// Stored default grids by owner; an owner missing from the map does not exist.
const grids = new Map<string, unknown>();
const projectOffices = new Map<string, string>([
  [PROJECT_ID, OFFICE_ID],
  [SIBLING_PROJECT_ID, SIBLING_OFFICE_ID],
  [FOREIGN_PROJECT_ID, FOREIGN_OFFICE_ID],
]);
const officeOrganizations = new Map<string, string>([
  [OFFICE_ID, ORGANIZATION_ID],
  [SIBLING_OFFICE_ID, ORGANIZATION_ID],
  [FOREIGN_OFFICE_ID, OTHER_ORGANIZATION_ID],
]);
const documentProjects = new Map<string, string>([
  [DOCUMENT_ID, PROJECT_ID],
  [SIBLING_DOCUMENT_ID, SIBLING_PROJECT_ID],
]);
let ownRow: { letterhead: unknown; referenceFilename: string } | null = null;

type OfficeLetterheadFields = {
  documentLetterheadGrid: unknown;
  documentLetterheadLayout: "split" | "banner" | null;
  documentLetterheadLines: string | null;
  documentLetterheadContact: string | null;
  documentLetterheadColor: string | null;
  documentLogoUrl: string | null;
};
const noOfficeLetterhead: OfficeLetterheadFields = {
  documentLetterheadGrid: null,
  documentLetterheadLayout: null,
  documentLetterheadLines: null,
  documentLetterheadContact: null,
  documentLetterheadColor: null,
  documentLogoUrl: null,
};
let officeLetterhead: OfficeLetterheadFields = noOfficeLetterhead;

// Reads may be held until `readers` of them are waiting (`holdReads`), so a
// test can start two writers from the same stored grid.
let readGate: { readers: number; waiting: (() => void)[] } | null = null;
const holdReads = (readers: number) => {
  readGate = { readers, waiting: [] };
};
const getDefaultLetterheadGrid = mock.fn(async (owner: Owner) => {
  const row = grids.has(ownerKey(owner))
    ? { grid: structuredClone(grids.get(ownerKey(owner))) }
    : null;
  const gate = readGate;
  if (gate) {
    await new Promise<void>((resolve) => {
      gate.waiting.push(resolve);
      if (gate.waiting.length >= gate.readers) {
        readGate = null;
        for (const release of gate.waiting) {
          release();
        }
      }
    });
  }
  return row;
});
// As the real query: null for an unknown owner and, with `ifStored`, for a
// grid that is no longer that value (the compare-and-set of its UPDATE);
// otherwise the grid as stored.
const setDefaultLetterheadGrid = mock.fn(
  async (
    owner: Owner,
    grid: GridLetterhead | null,
    options?: { ifStored?: { grid: unknown } },
  ) => {
    if (!grids.has(ownerKey(owner))) {
      return null;
    }
    if (
      options?.ifStored &&
      !isDeepStrictEqual(grids.get(ownerKey(owner)), options.ifStored.grid)
    ) {
      return null;
    }
    grids.set(ownerKey(owner), structuredClone(grid));
    return { grid: structuredClone(grid) };
  },
);
const getDocumentOwnLetterhead = mock.fn(async (_documentId: string) => ownRow);
const getProjectIdByDocumentId = mock.fn(
  async ({ id }: { id: string }) => documentProjects.get(id) ?? null,
);
// project → office → organization, deleted projects included (no filter).
const getOrganizationIdForProject = mock.fn(async (projectId: string) => {
  if (projectId === DELETED_PROJECT_ID) {
    return ORGANIZATION_ID;
  }
  const officeId = projectOffices.get(projectId);
  return (officeId && officeOrganizations.get(officeId)) ?? null;
});

const actualQueries = await import("@wildfires-org/turboplan-db/queries");
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    ...actualQueries,
    getDefaultLetterheadGrid,
    setDefaultLetterheadGrid,
    getDocumentOwnLetterhead,
    getProjectIdByDocumentId,
    getOrganizationIdForProject,
  },
});

// Mocked before any module under test loads. Grid logos are read by key with the bucket's credentials (stubbed: each
// "image" is the last segment of its key).
const readKeys: string[] = [];
const actualUpload = await import("@wildfires-org/turboplan-upload/server");
mock.module("@wildfires-org/turboplan-upload/server", {
  namedExports: {
    ...actualUpload,
    getObjectBytes: async (key: string) => {
      readKeys.push(key);
      return {
        data: new TextEncoder().encode(key.split("/").pop()),
        contentType: "image/png",
      };
    },
  },
});

// Not deleted projects only, as the real query.
const actualProjectQueries = await import("../src/server/projects/queries");
mock.module("../src/server/projects/queries", {
  namedExports: {
    ...actualProjectQueries,
    getProjectById: async (id: string) => {
      const officeId = projectOffices.get(id);
      return officeId ? { id, officeId } : null;
    },
  },
});

const actualOfficeQueries = await import("../src/server/offices/queries");
mock.module("../src/server/offices/queries", {
  namedExports: {
    ...actualOfficeQueries,
    getOfficeById: async (id: string) => {
      const organizationId = officeOrganizations.get(id);
      return organizationId
        ? { id, organizationId, ...officeLetterhead }
        : null;
    },
  },
});

// RBAC: every guard and check, in order, as "entity:action:id"; an
// "entity:action" in `denied` is refused. A guard whose id resolver gives
// null answers 400 without checking, as the real one does.
const events: string[] = [];
const denied = new Set<string>();
type GuardContext = {
  json: (body: unknown, status: number) => Response;
};
const actualRbacHono = await import("@wildfires-org/turboplan-rbac/hono");
mock.module("@wildfires-org/turboplan-rbac/hono", {
  namedExports: {
    ...actualRbacHono,
    requirePermission:
      (
        entityType: string,
        action: string,
        getEntityId: (c: GuardContext) => string | null,
      ) =>
      async (c: GuardContext, next: () => Promise<void>) => {
        const entityId = getEntityId(c);
        if (!entityId) {
          return c.json({ error: "Entity ID not found" }, 400);
        }
        events.push(`${entityType}:${action}:${entityId}`);
        if (denied.has(`${entityType}:${action}`)) {
          return c.json({ error: "Forbidden" }, 403);
        }
        await next();
      },
    getRBACServiceForRequest: () => ({
      checkPermission: async (
        userId: string,
        entityId: string,
        entityType: string,
        action: string,
      ) => {
        assert.equal(userId, USER_ID);
        events.push(`check:${entityType}:${action}:${entityId}`);
        return { allowed: !denied.has(`${entityType}:${action}`) };
      },
    }),
  },
});

const {
  officeLetterheadGridRouter,
  organizationLetterheadGridRouter,
  projectLetterheadTargetRouter,
} = await import("../src/server/routes/default-letterhead-grids");
const { defaultLetterheadGridVersion } = await import(
  "../src/server/default-letterhead-grid"
);

const app = new Hono();
app.use("*", async (c, next) => {
  c.set("user" as never, { userId: USER_ID, email: "u@example.test" } as never);
  await next();
});
app.route("/api/organizations", organizationLetterheadGridRouter);
app.route("/api/offices", officeLetterheadGridRouter);
app.route("/api/projects", projectLetterheadTargetRouter);

// Nothing here is fetched over HTTP: grid logos are read by key.
const originalFetch = globalThis.fetch;
const fetchedUrls: string[] = [];

// A request through the app. Every response — JSON or a logo's bytes — is
// checked for storage references: no host, no `url` or `key` field, no key.
const send = async (method: string, path: string, body?: unknown) => {
  const res = await app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
  });
  const text = await res.text();
  assert.equal(text.includes(STORAGE_HOST), false, `${method} ${path}`);
  assert.equal(text.includes('"url"'), false, `${method} ${path}`);
  assert.equal(text.includes('"key"'), false, `${method} ${path}`);
  assert.equal(text.includes("letterheads/"), false, `${method} ${path}`);
  assert.equal(text.includes("uploads/"), false, `${method} ${path}`);
  const isJson = res.headers.get("content-type")?.includes("json");
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    text,
    body: isJson && text ? JSON.parse(text) : null,
  };
};

const organizationPath = (id = ORGANIZATION_ID) =>
  `/api/organizations/${id}/letterhead-grid`;
const officePath = (id = OFFICE_ID) => `/api/offices/${id}/letterhead-grid`;

const writes = () =>
  setDefaultLetterheadGrid.mock.calls.map((call) => call.arguments);

beforeEach(() => {
  grids.clear();
  grids.set(`organization:${ORGANIZATION_ID}`, null);
  grids.set(`office:${OFFICE_ID}`, null);
  ownRow = { letterhead: copyGrid, referenceFilename: "blm-letter.pdf" };
  officeLetterhead = noOfficeLetterhead;
  events.length = 0;
  denied.clear();
  fetchedUrls.length = 0;
  readKeys.length = 0;
  readGate = null;
  for (const fn of [
    getDefaultLetterheadGrid,
    setDefaultLetterheadGrid,
    getDocumentOwnLetterhead,
    getProjectIdByDocumentId,
    getOrganizationIdForProject,
  ]) {
    fn.mock.resetCalls();
  }
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchedUrls.push(String(input));
    return new Response(null, { status: 500 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// RBAC and ids
// ---------------------------------------------------------------------------

describe("default letterhead grid routes: RBAC", () => {
  it("checks READ for the reads and UPDATE for the writes, on the path's entity", async () => {
    const cases: [string, string, unknown, string][] = [
      ["GET", organizationPath(), undefined, "organization:read"],
      ["GET", `${organizationPath()}/logo`, undefined, "organization:read"],
      ["PUT", organizationPath(), { grid: orgGrid }, "organization:update"],
      ["DELETE", organizationPath(), undefined, "organization:update"],
      ["GET", officePath(), undefined, "office:read"],
      ["GET", `${officePath()}/logo?index=1`, undefined, "office:read"],
      ["PUT", officePath(), { grid: orgGrid }, "office:update"],
      ["DELETE", officePath(), undefined, "office:update"],
    ];
    for (const [method, path, body, check] of cases) {
      events.length = 0;
      await send(method, path, body);
      const id = path.includes("/offices/") ? OFFICE_ID : ORGANIZATION_ID;
      assert.deepEqual(events, [`${check}:${id}`], `${method} ${path}`);
    }
  });

  it("refuses without the permission before reading or writing anything", async () => {
    denied.add("organization:read");
    denied.add("organization:update");
    denied.add("office:update");

    for (const [method, path, body] of [
      ["GET", organizationPath()],
      ["GET", `${organizationPath()}/logo`],
      ["PUT", organizationPath(), { grid: orgGrid }],
      ["DELETE", organizationPath()],
      [
        "POST",
        `${organizationPath()}/from-document`,
        { projectId: PROJECT_ID, documentId: DOCUMENT_ID },
      ],
      ["PUT", officePath(), { grid: orgGrid }],
      ["DELETE", officePath()],
    ] as [string, string, unknown?][]) {
      assert.equal((await send(method, path, body)).status, 403, path);
    }

    assert.equal(getDefaultLetterheadGrid.mock.callCount(), 0);
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
    assert.deepEqual(readKeys, []);
  });

  it("saving a document's copy checks UPDATE on the owner, then READ on the project", async () => {
    const res = await send("POST", `${officePath()}/from-document`, {
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
    });

    assert.equal(res.status, 200);
    assert.deepEqual(events, [
      `office:update:${OFFICE_ID}`,
      `project:read:${PROJECT_ID}`,
    ]);
  });

  it("saving a document's copy without READ on the project is refused unwritten", async () => {
    denied.add("project:read");

    const res = await send("POST", `${organizationPath()}/from-document`, {
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
    });

    assert.equal(res.status, 403);
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("answers 400 for an id that is not a UUID, before any permission check", async () => {
    for (const [method, path, body] of [
      ["GET", "/api/organizations/not-a-uuid/letterhead-grid"],
      ["GET", "/api/organizations/not-a-uuid/letterhead-grid/logo"],
      [
        "PUT",
        "/api/organizations/not-a-uuid/letterhead-grid",
        { grid: orgGrid },
      ],
      ["DELETE", "/api/organizations/not-a-uuid/letterhead-grid"],
      [
        "POST",
        "/api/organizations/not-a-uuid/letterhead-grid/from-document",
        { projectId: PROJECT_ID, documentId: DOCUMENT_ID },
      ],
      ["GET", `/api/offices/${OFFICE_ID}x/letterhead-grid`],
      ["DELETE", "/api/offices/1/letterhead-grid"],
      ["GET", "/api/projects/not-a-uuid/letterhead-target"],
    ] as [string, string, unknown?][]) {
      assert.equal((await send(method, path, body)).status, 400, path);
    }

    assert.deepEqual(events, []);
    assert.equal(getDefaultLetterheadGrid.mock.callCount(), 0);
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("answers 400 for a malformed from-document body before the project check", async () => {
    for (const body of [
      "{not json",
      {},
      { projectId: PROJECT_ID },
      { projectId: "not-a-uuid", documentId: DOCUMENT_ID },
      { projectId: PROJECT_ID, documentId: "../../etc" },
    ]) {
      events.length = 0;
      const res = await send(
        "POST",
        `${organizationPath()}/from-document`,
        body,
      );
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.body, { error: "Invalid request body" });
      assert.deepEqual(events, [`organization:update:${ORGANIZATION_ID}`]);
    }
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });
});

// ---------------------------------------------------------------------------
// POST /:id/letterhead-grid/from-document
// ---------------------------------------------------------------------------

describe("POST /:id/letterhead-grid/from-document", () => {
  const save = (path: string, projectId: string, documentId: string) =>
    send("POST", `${path}/from-document`, { projectId, documentId });

  it("writes the copy's stored grid on the organization and returns its public form", async () => {
    const res = await save(organizationPath(), PROJECT_ID, DOCUMENT_ID);

    assert.equal(res.status, 200);
    // Unconditional: saving replaces whatever grid the owner had.
    const saved = { cells: copyGrid.cells, color: "#1f5f3a" };
    assert.deepEqual(writes(), [
      [
        { kind: "organization", id: ORGANIZATION_ID },
        // Logo keys kept server-side (shared with the copy); the colour
        // normalised.
        saved,
      ],
    ]);
    assert.deepEqual(res.body, {
      grid: {
        cells: [
          { kind: "logo", x: 0.85, width: 0.15, height: 0.15, index: 1 },
          { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
          textCell("Bureau of Land Management"),
        ],
        color: "#1f5f3a",
      },
      version: await defaultLetterheadGridVersion(saved),
    });
  });

  it("writes on the office when the project is in that office", async () => {
    const res = await save(officePath(), PROJECT_ID, DOCUMENT_ID);

    assert.equal(res.status, 200);
    const [[owner, grid]] = writes();
    assert.deepEqual(owner, { kind: "office", id: OFFICE_ID });
    assert.deepEqual(grid?.cells, copyGrid.cells);
  });

  it("saves any project of the organization, in whichever office", async () => {
    ownRow = { letterhead: orgGrid, referenceFilename: "letter.pdf" };

    const res = await save(
      organizationPath(),
      SIBLING_PROJECT_ID,
      SIBLING_DOCUMENT_ID,
    );

    assert.equal(res.status, 200);
    assert.equal(writes().length, 1);
  });

  it("keeps the copy's base text size, in the default and its public form", async () => {
    ownRow = {
      letterhead: { ...copyGrid, fontSize: 0.0123 },
      referenceFilename: "blm-letter.pdf",
    };

    const res = await save(organizationPath(), PROJECT_ID, DOCUMENT_ID);

    assert.equal(res.status, 200);
    const [[, grid]] = writes();
    assert.equal(grid?.fontSize, 0.0123);
    assert.equal(res.body.grid.fontSize, 0.0123);
  });

  it("saves the copy as it renders: overlapping cells clipped", async () => {
    ownRow = {
      letterhead: {
        cells: [
          { ...logoCell(REFERENCE_LOGO), width: 0.3, height: 0.3 },
          textCell("Bureau of Land Management", 0.2, 0.8),
        ],
        color: null,
      },
      referenceFilename: "blm-letter.pdf",
    };

    const res = await save(organizationPath(), PROJECT_ID, DOCUMENT_ID);

    assert.equal(res.status, 200);
    const [[, grid]] = writes();
    const [logo] = grid?.cells ?? [];
    assert.equal(logo?.kind, "logo");
    assert.equal(logo?.width, 0.2);
    assert.ok(Math.abs((logo?.kind === "logo" ? logo.height : 0) - 0.2) < 1e-9);
  });

  it("answers the same 404, unwritten, for every refusal", async () => {
    const notFound = { error: "Document or letterhead not found" };
    const refusals: [string, string, string, typeof ownRow][] = [
      // The project is in another organization.
      [organizationPath(), FOREIGN_PROJECT_ID, DOCUMENT_ID, ownRow],
      // The project is in another office of the same organization.
      [officePath(), SIBLING_PROJECT_ID, SIBLING_DOCUMENT_ID, ownRow],
      // The project is deleted.
      [organizationPath(), DELETED_PROJECT_ID, DOCUMENT_ID, ownRow],
      // The document is in another project.
      [organizationPath(), PROJECT_ID, SIBLING_DOCUMENT_ID, ownRow],
      // An unknown document.
      [organizationPath(), PROJECT_ID, UNKNOWN_ID, ownRow],
      // No copy, or none that validates.
      [organizationPath(), PROJECT_ID, DOCUMENT_ID, null],
      [
        organizationPath(),
        PROJECT_ID,
        DOCUMENT_ID,
        { letterhead: "not a grid", referenceFilename: "a.pdf" },
      ],
      [
        organizationPath(),
        PROJECT_ID,
        DOCUMENT_ID,
        { letterhead: { cells: [], color: null }, referenceFilename: "a.pdf" },
      ],
      // More logos than a grid may hold.
      [
        organizationPath(),
        PROJECT_ID,
        DOCUMENT_ID,
        {
          letterhead: {
            cells: [
              logoCell(REFERENCE_LOGO),
              logoCell(REFERENCE_SEAL, 0.3),
              logoCell(REFERENCE_SEAL, 0.6),
            ],
            color: null,
          },
          referenceFilename: "a.pdf",
        },
      ],
    ];

    for (const [path, projectId, documentId, row] of refusals) {
      ownRow = row;
      const res = await save(path, projectId, documentId);
      assert.equal(res.status, 404, `${path} ${projectId} ${documentId}`);
      assert.deepEqual(res.body, notFound);
    }
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("never reads the copy of a document outside the project", async () => {
    await save(organizationPath(), PROJECT_ID, SIBLING_DOCUMENT_ID);
    await save(officePath(), SIBLING_PROJECT_ID, SIBLING_DOCUMENT_ID);

    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("answers the same 404 when the owner is gone by the time it is written", async () => {
    grids.delete(`organization:${ORGANIZATION_ID}`);

    const res = await save(organizationPath(), PROJECT_ID, DOCUMENT_ID);

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Document or letterhead not found" });
  });
});

// ---------------------------------------------------------------------------
// GET /:id/letterhead-grid
// ---------------------------------------------------------------------------

describe("GET /:id/letterhead-grid", () => {
  it("sends the stored grid in its public form, with its version", async () => {
    grids.set(`organization:${ORGANIZATION_ID}`, copyGrid);

    const res = await send("GET", organizationPath());

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.grid.cells.map(
        (cell: { kind: string; index?: number }) => cell.index,
      ),
      [1, 0, undefined],
    );
    assert.equal(res.body.grid.color, "#1F5F3A");
    assert.match(res.body.version, /^[0-9a-f]{16}$/);
    assert.equal(
      res.body.version,
      await defaultLetterheadGridVersion(copyGrid),
    );
  });

  it("versions the stored value: any change gives another, key order none", async () => {
    const version = await defaultLetterheadGridVersion(copyGrid);
    const reordered = {
      color: copyGrid.color,
      cells: copyGrid.cells.map((cell) =>
        Object.fromEntries(Object.entries(cell).reverse()),
      ),
    };

    assert.equal(await defaultLetterheadGridVersion(reordered), version);
    assert.notEqual(
      await defaultLetterheadGridVersion({ ...copyGrid, color: "#1f5f3a" }),
      version,
    );
    assert.notEqual(
      await defaultLetterheadGridVersion({
        ...copyGrid,
        cells: [{ ...copyGrid.cells[0], x: 0.84 }, ...copyGrid.cells.slice(1)],
      }),
      version,
    );
    assert.equal(await defaultLetterheadGridVersion(null), null);
  });

  it("sends a null grid without one, or with one that cannot render", async () => {
    for (const stored of [null, "not a grid", { cells: [], color: null }]) {
      grids.set(`office:${OFFICE_ID}`, stored);
      const res = await send("GET", officePath());
      assert.equal(res.status, 200);
      // Versioned all the same while something is stored: the editor writes
      // over it with that version.
      assert.deepEqual(res.body, {
        grid: null,
        version: await defaultLetterheadGridVersion(stored),
      });
    }
    grids.set(`office:${OFFICE_ID}`, null);
    assert.deepEqual((await send("GET", officePath())).body, {
      grid: null,
      version: null,
    });
  });

  it("answers 404 for an unknown owner", async () => {
    const res = await send("GET", officePath(UNKNOWN_ID));

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Office not found" });
  });
});

// ---------------------------------------------------------------------------
// PUT /:id/letterhead-grid
// ---------------------------------------------------------------------------

describe("PUT /:id/letterhead-grid", () => {
  // The version of what is stored for the owner of `path`, as GET sends it.
  const versionOf = (path: string) => {
    const [, , collection, id] = path.split("/");
    const kind = collection === "offices" ? "office" : "organization";
    return defaultLetterheadGridVersion(grids.get(`${kind}:${id}`) ?? null);
  };
  // An edit made on the stored grid's current version, unless one is given.
  const put = async (
    grid: unknown,
    path = organizationPath(),
    version?: string | null,
  ) =>
    send("PUT", path, {
      grid,
      version: version === undefined ? await versionOf(path) : version,
    });

  const keptLogo = (index: number, x = 0) => ({
    kind: "logo",
    x,
    width: 0.15,
    height: 0.15,
    index,
  });
  const newLogo = (url: string, x = 0) => ({
    kind: "logo",
    x,
    width: 0.15,
    height: 0.05,
    url,
  });
  const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
  const editedText = {
    kind: "text",
    x: 0.2,
    width: 0.6,
    align: "right",
    lines: [
      {
        text: `  Example ${ZERO_WIDTH_SPACE} Agency `,
        bold: true,
        size: "normal",
      },
      { text: "   ", bold: false, size: "small" },
    ],
  };

  beforeEach(() => {
    grids.set(`organization:${ORGANIZATION_ID}`, copyGrid);
  });

  it("keeps a stored logo by its index and stores its key", async () => {
    const res = await put({
      cells: [keptLogo(1), editedText, keptLogo(0, 0.85)],
      color: "#ABCDEF",
    });

    assert.equal(res.status, 200);
    const saved = {
      cells: [
        logoCell(REFERENCE_SEAL),
        {
          ...editedText,
          lines: [{ text: "Example Agency", bold: true, size: "normal" }],
        },
        logoCell(REFERENCE_LOGO, 0.85),
      ],
      color: "#abcdef",
    };
    assert.deepEqual(writes(), [
      [
        { kind: "organization", id: ORGANIZATION_ID },
        saved,
        // Written only over the grid the edit was made on.
        { ifStored: { grid: copyGrid } },
      ],
    ]);
    assert.deepEqual(res.body.grid.cells[0], keptLogo(0));
    assert.deepEqual(res.body.grid.cells[2], keptLogo(1, 0.85));
    // The new version: the one GET now sends.
    assert.equal(res.body.version, await defaultLetterheadGridVersion(saved));
    assert.equal(
      (await send("GET", organizationPath())).body.version,
      res.body.version,
    );
  });

  it("stores a new logo the caller uploaded by its object key", async () => {
    const res = await put({
      cells: [newLogo(`${OWN_UPLOAD}?v=2`), editedText],
      color: null,
    });

    assert.equal(res.status, 200);
    const [[, grid]] = writes();
    assert.deepEqual(grid?.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.05,
      key: OWN_UPLOAD_KEY,
    });
    assert.deepEqual(res.body.grid.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.05,
      index: 0,
    });
  });

  it("refuses a new logo that is not the caller's own upload, naming the field", async () => {
    for (const url of [
      OTHER_UPLOAD,
      // A reference crop: ours, but nobody's upload.
      `${STORAGE}/${REFERENCE_LOGO}`,
      // The caller's upload under a read-only alias base.
      `${ALIAS}/${OWN_UPLOAD_KEY}`,
      `${STORAGE}/uploads/${USER_ID}/../${OTHER_USER_ID}/logo.png`,
      METADATA_URL,
      // A bare key is not an upload URL.
      OWN_UPLOAD_KEY,
    ]) {
      const res = await put({
        cells: [editedText, newLogo(url, 0.85)],
        color: null,
      });
      assert.equal(res.status, 400, url);
      assert.deepEqual(res.body, {
        error: "Column 2: upload the logo again",
        field: "cells.1.url",
      });
    }
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("refuses an unknown logo index", async () => {
    const res = await put({ cells: [keptLogo(2), editedText], color: null });

    assert.equal(res.status, 400);
    assert.equal(res.body.field, "cells.0.index");
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("refuses a grid that breaks the strict rules with the offending field", async () => {
    const cases: [unknown, string][] = [
      // Overlapping cells.
      [
        { cells: [keptLogo(0), { ...editedText, x: 0.1 }], color: null },
        "cells",
      ],
      // Past the right edge.
      [
        { cells: [{ ...editedText, x: 0.5, width: 0.6 }], color: null },
        "cells",
      ],
      // A line longer than MAX_GRID_LINE_CHARS once cleaned.
      [
        {
          cells: [
            {
              ...editedText,
              lines: [{ text: "x".repeat(201), bold: false, size: "normal" }],
            },
          ],
          color: null,
        },
        "cells.0.lines.0.text",
      ],
      // A colour that is not a hex colour.
      [{ cells: [editedText], color: "red" }, "color"],
      // Nothing to show.
      [
        {
          cells: [
            {
              ...editedText,
              lines: [{ text: " ", bold: false, size: "normal" }],
            },
          ],
          color: null,
        },
        "cells.0.lines",
      ],
    ];
    for (const [grid, field] of cases) {
      const res = await put(grid);
      assert.equal(res.status, 400, JSON.stringify(grid));
      assert.equal(res.body.field, field, JSON.stringify(grid));
      assert.equal(typeof res.body.error, "string");
    }
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("answers 400 Invalid request body for a malformed body, grid shape or version", async () => {
    const version = await versionOf(organizationPath());
    const grid = { cells: [editedText], color: null };
    for (const body of [
      "{not json",
      {},
      { grid: null, version },
      { grid: { cells: "x", color: null }, version },
      // A logo cell with both an index and a URL.
      {
        grid: { cells: [{ ...keptLogo(0), url: OWN_UPLOAD }], color: null },
        version,
      },
      {
        grid: {
          cells: Array.from({ length: 9 }, () => editedText),
          color: null,
        },
        version,
      },
      // The version is required, null or 16 lowercase hex characters.
      { grid },
      { grid, version: "" },
      { grid, version: version?.toUpperCase() },
      { grid, version: `${version}0` },
      { grid, version: 1 },
    ]) {
      const res = await send("PUT", organizationPath(), body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.body, { error: "Invalid request body" });
    }
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("keeps the stored grid's base text size through an edit", async () => {
    grids.set(`organization:${ORGANIZATION_ID}`, {
      ...copyGrid,
      fontSize: 0.0123,
    });

    const res = await put({
      cells: [keptLogo(1), editedText, keptLogo(0, 0.85)],
      color: null,
    });

    assert.equal(res.status, 200);
    const [[, grid]] = writes();
    assert.equal(grid?.fontSize, 0.0123);
    assert.equal(res.body.grid.fontSize, 0.0123);
  });

  it("gives an owner without a grid one from text columns and new uploads", async () => {
    const res = await put(
      { cells: [newLogo(OWN_UPLOAD), editedText], color: null },
      officePath(),
    );

    assert.equal(res.status, 200);
    const [[owner, grid]] = writes();
    assert.deepEqual(owner, { kind: "office", id: OFFICE_ID });
    assert.equal(grid?.cells.length, 2);

    // There is no stored logo to keep.
    setDefaultLetterheadGrid.mock.resetCalls();
    grids.set(`office:${OFFICE_ID}`, null);
    const kept = await put(
      { cells: [keptLogo(0), editedText], color: null },
      officePath(),
    );
    assert.equal(kept.status, 400);
    assert.equal(kept.body.field, "cells.0.index");
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("answers 404 for an unknown owner", async () => {
    const res = await put(
      { cells: [editedText], color: null },
      organizationPath(UNKNOWN_ID),
    );

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Organization not found" });
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("answers 409, unwritten, to an edit made on another version", async () => {
    const conflict = {
      error: "The letterhead was changed meanwhile — reopen the editor",
    };
    const edit = { cells: [editedText], color: null };
    const cases: [string, string | null][] = [
      // Read before another edit changed the colour.
      [
        organizationPath(),
        await defaultLetterheadGridVersion({ ...copyGrid, color: "#000000" }),
      ],
      // Read before a grid was set.
      [organizationPath(), null],
      // Read while a grid was set; it has been removed since.
      [officePath(), await defaultLetterheadGridVersion(copyGrid)],
    ];
    for (const [path, version] of cases) {
      const res = await put(edit, path, version);
      assert.equal(res.status, 409, `${path} ${version}`);
      assert.deepEqual(res.body, conflict);
    }
    // Even an edit that would be invalid on the newer grid: its logo indexes
    // refer to the version it was made on.
    const stale = await put(
      { cells: [keptLogo(5), editedText], color: null },
      organizationPath(),
      null,
    );
    assert.equal(stale.status, 409);
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 0);
  });

  it("saves only one of two concurrent edits made on the same version", async () => {
    const version = await versionOf(organizationPath());
    // Both requests read the stored grid before either writes.
    holdReads(2);

    const [first, second] = await Promise.all([
      put(
        { cells: [keptLogo(0), editedText], color: "#111111" },
        organizationPath(),
        version,
      ),
      put(
        { cells: [editedText], color: "#222222" },
        organizationPath(),
        version,
      ),
    ]);

    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
    // Both tried, each only over the grid it read; the loser matched nothing.
    assert.equal(setDefaultLetterheadGrid.mock.callCount(), 2);
    for (const [, , options] of writes()) {
      assert.deepEqual(options, { ifStored: { grid: copyGrid } });
    }
    const winner = first.status === 200 ? first : second;
    assert.equal(await versionOf(organizationPath()), winner.body.version);
  });
});

// ---------------------------------------------------------------------------
// DELETE /:id/letterhead-grid
// ---------------------------------------------------------------------------

describe("DELETE /:id/letterhead-grid", () => {
  it("sets the grid to null", async () => {
    grids.set(`office:${OFFICE_ID}`, copyGrid);

    const res = await send("DELETE", officePath());

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { grid: null, version: null });
    assert.deepEqual(writes(), [[{ kind: "office", id: OFFICE_ID }, null]]);
    // The logo objects are left alone: copies may still use them.
    assert.deepEqual(readKeys, []);
  });

  it("answers 404 for an unknown owner", async () => {
    const res = await send("DELETE", organizationPath(UNKNOWN_ID));

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Organization not found" });
  });
});

// ---------------------------------------------------------------------------
// GET /:id/letterhead-grid/logo
// ---------------------------------------------------------------------------

describe("GET /:id/letterhead-grid/logo", () => {
  const logo = (query = "", path = organizationPath()) =>
    send("GET", `${path}/logo${query}`);

  beforeEach(() => {
    grids.set(`organization:${ORGANIZATION_ID}`, copyGrid);
  });

  it("serves the logo at index (left to right), 0 by default, read by key", async () => {
    const first = await logo();
    assert.equal(first.status, 200);
    assert.equal(first.contentType, "image/png");
    assert.equal(first.text, "logo-0-abc.png");

    const second = await logo("?index=1");
    assert.equal(second.status, 200);
    assert.equal(second.text, "logo-1-abc.png");

    // Only the requested logo is read, with the bucket's credentials —
    // never over HTTP.
    assert.deepEqual(readKeys, [REFERENCE_LOGO, REFERENCE_SEAL]);
    assert.deepEqual(fetchedUrls, []);
  });

  it("answers 400 for an index that is not a small non-negative integer, before any permission check", async () => {
    for (const index of [
      "",
      "abc",
      "-1",
      "1.0",
      "1e0",
      "001",
      "2",
      "99",
      " 1",
    ]) {
      const res = await logo(`?index=${encodeURIComponent(index)}`);
      assert.equal(res.status, 400, JSON.stringify(index));
      assert.deepEqual(res.body, { error: "Invalid index" });
    }
    assert.deepEqual(events, []);
    assert.equal(getDefaultLetterheadGrid.mock.callCount(), 0);
    assert.deepEqual(readKeys, []);
  });

  it("answers 204 without a grid and past the last logo", async () => {
    grids.set(`office:${OFFICE_ID}`, null);
    assert.equal((await logo("", officePath())).status, 204);
    assert.equal((await logo("", officePath(UNKNOWN_ID))).status, 204);

    grids.set(`office:${OFFICE_ID}`, orgGrid);
    assert.equal((await logo("?index=1", officePath())).status, 204);

    assert.deepEqual(readKeys, []);
  });

  it("never reads a stored logo that is not a letterhead logo key", async () => {
    for (const cell of [
      logoCell(METADATA_URL),
      logoCell("org-logos/0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e.png"),
      logoCell("letterheads/../uploads/other/logo.png"),
      { kind: "logo", x: 0, width: 0.15, height: 0.15, url: METADATA_URL },
    ]) {
      grids.set(`organization:${ORGANIZATION_ID}`, {
        cells: [cell, textCell("Example Agency")],
        color: null,
      });

      const res = await logo();

      assert.equal(res.status, 204, JSON.stringify(cell));
    }
    assert.deepEqual(readKeys, []);
    assert.deepEqual(fetchedUrls, []);
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/letterhead-target
// ---------------------------------------------------------------------------

describe("GET /api/projects/:projectId/letterhead-target", () => {
  const target = (projectId = PROJECT_ID) =>
    send("GET", `/api/projects/${projectId}/letterhead-target`);

  it("names the project's office and organization and checks UPDATE on both", async () => {
    const res = await target();

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      organizationId: ORGANIZATION_ID,
      officeId: OFFICE_ID,
      officeHasOwnDefault: false,
      canEditOrganization: true,
      canEditOffice: true,
    });
    assert.deepEqual(events, [
      `project:read:${PROJECT_ID}`,
      `check:organization:update:${ORGANIZATION_ID}`,
      `check:office:update:${OFFICE_ID}`,
    ]);
  });

  it("reports the can* flags from RBAC", async () => {
    denied.add("organization:update");
    const organizationDenied = await target();
    assert.equal(organizationDenied.body.canEditOrganization, false);
    assert.equal(organizationDenied.body.canEditOffice, true);

    denied.clear();
    denied.add("office:update");
    const officeDenied = await target();
    assert.equal(officeDenied.body.canEditOrganization, true);
    assert.equal(officeDenied.body.canEditOffice, false);
  });

  it("reports an office default from a grid and from the legacy fields", async () => {
    officeLetterhead = {
      ...noOfficeLetterhead,
      documentLetterheadGrid: orgGrid,
    };
    assert.equal((await target()).body.officeHasOwnDefault, true);

    officeLetterhead = {
      ...noOfficeLetterhead,
      documentLetterheadLayout: "split",
      documentLetterheadLines: "Example Ranger District",
    };
    assert.equal((await target()).body.officeHasOwnDefault, true);

    officeLetterhead = {
      ...noOfficeLetterhead,
      documentLetterheadLayout: "banner",
      documentLogoUrl: `${STORAGE}/branding/banner.png`,
    };
    assert.equal((await target()).body.officeHasOwnDefault, true);
  });

  it("reports no office default for an unusable grid and unconfigured fields", async () => {
    officeLetterhead = {
      ...noOfficeLetterhead,
      documentLetterheadGrid: { cells: [], color: null },
      documentLetterheadColor: "#123456",
      documentLetterheadContact: "1 Main St",
    };

    assert.equal((await target()).body.officeHasOwnDefault, false);
  });

  it("refuses without READ on the project, and 404s a deleted project", async () => {
    denied.add("project:read");
    assert.equal((await target()).status, 403);
    assert.deepEqual(events, [`project:read:${PROJECT_ID}`]);

    denied.clear();
    const deleted = await target(DELETED_PROJECT_ID);
    assert.equal(deleted.status, 404);
    assert.deepEqual(deleted.body, { error: "Project not found" });
  });
});
