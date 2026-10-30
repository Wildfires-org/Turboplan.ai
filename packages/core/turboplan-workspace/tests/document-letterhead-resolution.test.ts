import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import type { GridLetterhead } from "../src/letterhead-grid";

const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-4444-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const STORAGE = "https://files.example.test";
// A legacy logo (office/org letterhead, banner, footer): a stored URL,
// fetched over HTTP from our storage only.
const OFFICE_LOGO = `${STORAGE}/branding/office-logo.png`;
const ORGANIZATION_LOGO = `${STORAGE}/branding/org-logo.png`;
// A banner layout's `documentLogoUrl`: the full-width banner graphic.
const OFFICE_BANNER = `${STORAGE}/branding/office-banner.png`;
const ORGANIZATION_BANNER = `${STORAGE}/branding/org-banner.png`;
// Grid logos: R2 object keys, read with the bucket's credentials.
const REFERENCE_LOGO = "letterheads/project/ref/logo-0-abc.png";
const REFERENCE_SEAL = "letterheads/project/ref/logo-1-abc.png";
const GRID_DEFAULT_LOGO = "letterheads/project/org-doc/logo-0-def.png";

// Logo URLs only count as ours (and are fetched) under this storage base;
// the storage check reads the full (dummy) R2 configuration.
Object.assign(process.env, {
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_BUCKET_NAME: "test",
  R2_PUBLIC_URL: STORAGE,
});

const textCell = (lines: [string, boolean][]) => ({
  kind: "text" as const,
  x: 0.2,
  width: 0.6,
  align: "left" as const,
  lines: lines.map(([text, bold]) => ({
    text,
    bold,
    size: "normal" as const,
  })),
});

const logoCell = (key: string, x = 0) => ({
  kind: "logo" as const,
  x,
  width: 0.15,
  height: 0.15,
  key,
});

const referenceGrid: GridLetterhead = {
  cells: [
    logoCell(REFERENCE_LOGO),
    textCell([
      ["Bureau of Land Management", true],
      ["1 Main St", false],
    ]),
  ],
  color: "#1f5f3a",
};

const orgGrid: GridLetterhead = {
  cells: [
    logoCell(GRID_DEFAULT_LOGO),
    textCell([["Example Consulting", true]]),
  ],
  color: null,
};

type EntityLetterhead = {
  documentLetterheadGrid: unknown;
  documentLetterheadLayout: string | null;
  documentLetterheadLines: string | null;
  documentLetterheadContact: string | null;
  documentLetterheadColor: string | null;
  documentLogoUrl: string | null;
  documentFooterText?: string | null;
};

const unconfigured: EntityLetterhead = {
  documentLetterheadGrid: null,
  documentLetterheadLayout: null,
  documentLetterheadLines: null,
  documentLetterheadContact: null,
  documentLetterheadColor: null,
  documentLogoUrl: null,
};

const officeLegacy: EntityLetterhead = {
  ...unconfigured,
  documentLetterheadLayout: "split",
  documentLetterheadLines: "Example Ranger District",
  documentLogoUrl: OFFICE_LOGO,
};

const officeDefault = {
  layout: "split",
  nameLines: ["Example Ranger District"],
  contactLines: [],
  color: null,
};

// getProjectById / getOfficeById / getOrganizationById all read
// `db.select().from(<table>).where(…)`: rows are served per table.
const { office, organization, project } = await import(
  "@wildfires-org/turboplan-db"
);
let officeRow: EntityLetterhead = officeLegacy;
let organizationRow: EntityLetterhead = unconfigured;
const rowsFor = (table: unknown): unknown[] => {
  if (table === project) {
    return [{ id: PROJECT_ID, officeId: OFFICE_ID }];
  }
  if (table === office) {
    return [{ id: OFFICE_ID, organizationId: ORGANIZATION_ID, ...officeRow }];
  }
  if (table === organization) {
    return [{ id: ORGANIZATION_ID, ...organizationRow }];
  }
  return [];
};
const actualDbClient = await import("@wildfires-org/turboplan-db/db-client");
mock.module("@wildfires-org/turboplan-db/db-client", {
  namedExports: {
    ...actualDbClient,
    db: {
      select: () => ({
        from: (table: unknown) => ({ where: async () => rowsFor(table) }),
      }),
    },
  },
});

// The real query module, with the document-letterhead reads stubbed.
const actualQueries = await import("@wildfires-org/turboplan-db/queries");
let documentProjectId = PROJECT_ID;
let selectionRow: { letterheadId: string | null; useOwn: boolean } | null =
  null;
// The copy's version is its `updated_at`.
const COPY_UPDATED_AT = new Date("2026-10-20T10:00:00.123Z");
let ownRow: {
  letterhead: unknown;
  referenceFilename: string;
  updatedAt: Date;
} | null = null;
const getProjectIdByDocumentId = mock.fn(async () => documentProjectId);
const getDocumentLetterheadSelectionRow = mock.fn(async () => selectionRow);
const getDocumentOwnLetterhead = mock.fn(async () => ownRow);

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    ...actualQueries,
    getProjectIdByDocumentId,
    getDocumentLetterheadSelectionRow,
    getDocumentOwnLetterhead,
    getOrganizationIdForProject: async () => ORGANIZATION_ID,
    listDocumentLetterheads: async () => [],
  },
});

// Grid logos are read by key through the upload package's credentialed
// `getObjectBytes` (stubbed: each "image" is its key; a key in `failingKeys`
// is missing, one in `typedKeys` stored with that content type).
const readKeys: string[] = [];
const readOptions: unknown[] = [];
const failingKeys = new Set<string>();
const typedKeys = new Map<string, string>();
const actualUpload = await import("@wildfires-org/turboplan-upload/server");
mock.module("@wildfires-org/turboplan-upload/server", {
  namedExports: {
    ...actualUpload,
    getObjectBytes: async (key: string, options: unknown) => {
      readKeys.push(key);
      readOptions.push(options);
      return failingKeys.has(key)
        ? null
        : {
            data: new TextEncoder().encode(key),
            contentType: typedKeys.get(key) ?? "image/png",
          };
    },
  },
});

const {
  getDocumentLetterheadOverview,
  getProjectDocumentBranding,
  resolveDocumentLetterhead,
  resolveDocumentLetterheadLogo,
} = await import("../src/server/projects/queries");

// Each legacy logo "image" is its own URL, so a test can tell which one was
// fetched; a URL in `failingUrls` answers 500, one in `redirectingUrls` a
// redirect.
const originalFetch = globalThis.fetch;
const fetchedUrls: string[] = [];
const fetchInits: (RequestInit | undefined)[] = [];
const failingUrls = new Set<string>();
const redirectingUrls = new Set<string>();
const decode = (logo: { data: Uint8Array } | null) =>
  logo ? new TextDecoder().decode(logo.data) : null;

const selectOwn = () => {
  selectionRow = { letterheadId: null, useOwn: true };
};

beforeEach(() => {
  officeRow = officeLegacy;
  organizationRow = unconfigured;
  documentProjectId = PROJECT_ID;
  selectionRow = null;
  ownRow = {
    letterhead: referenceGrid,
    referenceFilename: "blm-letter.pdf",
    updatedAt: COPY_UPDATED_AT,
  };
  fetchedUrls.length = 0;
  fetchInits.length = 0;
  failingUrls.clear();
  redirectingUrls.clear();
  readKeys.length = 0;
  readOptions.length = 0;
  failingKeys.clear();
  typedKeys.clear();
  for (const fn of [
    getProjectIdByDocumentId,
    getDocumentLetterheadSelectionRow,
    getDocumentOwnLetterhead,
  ]) {
    fn.mock.resetCalls();
  }
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    fetchedUrls.push(url);
    fetchInits.push(init);
    if (failingUrls.has(url)) {
      return new Response("boom", { status: 500 });
    }
    if (redirectingUrls.has(url)) {
      // What `redirect: "manual"` hands back: the 3xx itself.
      return new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/x.png" },
      });
    }
    return new Response(new TextEncoder().encode(url), {
      headers: { "content-type": "image/png" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("resolveDocumentLetterhead with the document's own copy", () => {
  it("renders the copy, with the logo of its first logo cell", async () => {
    selectOwn();

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "own");
    assert.deepEqual(resolved.letterhead, {
      layout: "grid",
      grid: referenceGrid,
      nameLines: ["Bureau of Land Management"],
      contactLines: ["1 Main St"],
      color: "#1f5f3a",
    });
    assert.equal(decode(resolved.logo), REFERENCE_LOGO);
    assert.deepEqual(resolved.logos.map(decode), [REFERENCE_LOGO]);
    // By key, with the bucket's credentials: never over HTTP.
    assert.deepEqual(readKeys, [REFERENCE_LOGO]);
    assert.deepEqual(fetchedUrls, []);
  });

  it("uses the office → org letterhead logo when the copy has no logo cell", async () => {
    selectOwn();
    ownRow = {
      letterhead: { ...referenceGrid, cells: referenceGrid.cells.slice(1) },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "own");
    assert.equal(decode(resolved.logo), OFFICE_LOGO);
    assert.deepEqual(resolved.logos, []);
  });

  it("gives no logo, not the office's, when the copy's logo fails to load", async () => {
    selectOwn();
    failingKeys.add(REFERENCE_LOGO);

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "own");
    assert.equal(resolved.logo, null);
    assert.deepEqual(resolved.logos, [null]);
    assert.deepEqual(readKeys, [REFERENCE_LOGO]);
    assert.deepEqual(fetchedUrls, []);
  });

  it("never reads a logo that is not a letterhead logo key: the copy does not render", async () => {
    const metadataUrl = "http://169.254.169.254/latest/meta-data/x.png";
    selectOwn();
    for (const cell of [
      logoCell("org-logos/0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e.png"),
      logoCell("letterheads/../uploads/other/logo.png"),
      logoCell("/letterheads/project/ref/logo-0-abc.png"),
      logoCell(metadataUrl),
      // A logo cell in the old URL format.
      {
        kind: "logo" as const,
        x: 0,
        width: 0.15,
        height: 0.15,
        url: metadataUrl,
      },
    ]) {
      ownRow = {
        letterhead: {
          ...referenceGrid,
          cells: [cell, ...referenceGrid.cells.slice(1)],
        },
        referenceFilename: "blm-letter.pdf",
        updatedAt: COPY_UPDATED_AT,
      };

      const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

      // Not a valid copy: the default renders, with its own (legacy) logo.
      assert.equal(resolved.selection, "default", JSON.stringify(cell));
      assert.deepEqual(resolved.letterhead, officeDefault);
    }
    assert.deepEqual(readKeys, []);
    assert.equal(fetchedUrls.includes(metadataUrl), false);
  });

  it("fetches every logo cell, left to right, keeping a failed one's slot", async () => {
    selectOwn();
    ownRow = {
      letterhead: {
        ...referenceGrid,
        // Stored right logo first: the order is the cells' x, not the array.
        cells: [logoCell(REFERENCE_SEAL, 0.85), ...referenceGrid.cells],
      },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);
    assert.deepEqual(resolved.logos.map(decode), [
      REFERENCE_LOGO,
      REFERENCE_SEAL,
    ]);
    assert.equal(decode(resolved.logo), REFERENCE_LOGO);

    failingKeys.add(REFERENCE_LOGO);
    const degraded = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);
    assert.deepEqual(degraded.logos.map(decode), [null, REFERENCE_SEAL]);
    assert.equal(degraded.logo, null);
  });

  it("renders the default when the selected copy is missing", async () => {
    selectOwn();
    ownRow = null;

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "default");
    assert.deepEqual(resolved.letterhead, officeDefault);
    assert.equal(decode(resolved.logo), OFFICE_LOGO);
  });

  it("renders the default when the selected copy no longer validates", async () => {
    selectOwn();
    ownRow = {
      letterhead: { cells: [], color: null },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "default");
    assert.deepEqual(resolved.letterhead, officeDefault);
  });

  it("never reads the selection or copy of another project's document", async () => {
    selectOwn();
    documentProjectId = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "default");
    assert.deepEqual(resolved.letterhead, officeDefault);
    assert.equal(getDocumentLetterheadSelectionRow.mock.callCount(), 0);
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("does not read the copy when another letterhead is selected", async () => {
    await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
  });
});

describe("resolveDocumentLetterhead with a grid default", () => {
  it("prefers the office grid over the office's legacy fields", async () => {
    officeRow = { ...officeLegacy, documentLetterheadGrid: orgGrid };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.selection, "default");
    assert.equal(resolved.letterhead?.layout, "grid");
    assert.deepEqual(resolved.letterhead?.nameLines, ["Example Consulting"]);
    assert.equal(decode(resolved.logo), GRID_DEFAULT_LOGO);
    assert.deepEqual(resolved.logos.map(decode), [GRID_DEFAULT_LOGO]);
  });

  it("gives no logo, not the office's, when the grid default's logo fails", async () => {
    officeRow = { ...officeLegacy, documentLetterheadGrid: orgGrid };
    failingKeys.add(GRID_DEFAULT_LOGO);

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.letterhead?.layout, "grid");
    assert.equal(resolved.logo, null);
    assert.deepEqual(resolved.logos, [null]);
    assert.equal(fetchedUrls.includes(OFFICE_LOGO), false);
  });

  it("ignores an invalid office grid", async () => {
    officeRow = {
      ...officeLegacy,
      documentLetterheadGrid: { cells: "nope", color: null },
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.deepEqual(resolved.letterhead, officeDefault);
  });

  it("uses the organization grid when the office has no letterhead", async () => {
    officeRow = { ...unconfigured, documentLogoUrl: OFFICE_LOGO };
    organizationRow = {
      ...unconfigured,
      documentLetterheadGrid: {
        ...orgGrid,
        cells: orgGrid.cells.slice(1),
      },
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.letterhead?.layout, "grid");
    assert.deepEqual(resolved.letterhead?.nameLines, ["Example Consulting"]);
    // No logo cell: the office → org letterhead logo.
    assert.equal(decode(resolved.logo), OFFICE_LOGO);
    assert.deepEqual(resolved.logos, []);
  });

  it("keeps the office's legacy letterhead over an organization grid", async () => {
    organizationRow = { ...unconfigured, documentLetterheadGrid: orgGrid };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.deepEqual(resolved.letterhead, officeDefault);
  });
});

// A banner's `documentLogoUrl` is the banner graphic, drawn across the
// content width: it is never anyone's letterhead logo, so never the margin
// logo of a grid without logo cells nor the logo of another layout.
describe("banner graphics are never a letterhead logo", () => {
  const officeBanner: EntityLetterhead = {
    ...unconfigured,
    documentLetterheadLayout: "banner",
    documentLogoUrl: OFFICE_BANNER,
  };
  const copyWithoutLogo = () => {
    selectOwn();
    ownRow = {
      letterhead: { ...referenceGrid, cells: referenceGrid.cells.slice(1) },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };
  };

  it("skips the office banner for a copy's margin logo, using the organization's logo", async () => {
    copyWithoutLogo();
    officeRow = officeBanner;
    organizationRow = { ...unconfigured, documentLogoUrl: ORGANIZATION_LOGO };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.selection, "own");
    assert.equal(decode(resolved.logo), ORGANIZATION_LOGO);
    assert.equal(
      decode(await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0)),
      ORGANIZATION_LOGO,
    );
    assert.equal(fetchedUrls.includes(OFFICE_BANNER), false);
  });

  it("gives a copy no margin logo when the organization's is a banner too", async () => {
    copyWithoutLogo();
    officeRow = officeBanner;
    organizationRow = {
      ...unconfigured,
      documentLetterheadLayout: "banner",
      documentLogoUrl: ORGANIZATION_BANNER,
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.equal(resolved.logo, null);
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0),
      null,
    );
    assert.deepEqual(fetchedUrls, []);
  });

  it("never uses the banner of an office whose grid default replaced it", async () => {
    // The grid wins over the legacy fields, but the layout still says banner:
    // `documentLogoUrl` is still the banner graphic.
    officeRow = {
      ...officeBanner,
      documentLetterheadGrid: { ...orgGrid, cells: orgGrid.cells.slice(1) },
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.letterhead?.layout, "grid");
    assert.equal(resolved.logo, null);
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, undefined, 0),
      null,
    );
    assert.deepEqual(fetchedUrls, []);
  });

  it("never gives an office's legacy letterhead the organization's banner as its logo", async () => {
    officeRow = { ...officeLegacy, documentLogoUrl: null };
    organizationRow = {
      ...unconfigured,
      documentLetterheadLayout: "banner",
      documentLogoUrl: ORGANIZATION_BANNER,
    };

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.deepEqual(resolved.letterhead, officeDefault);
    assert.equal(resolved.logo, null);
    assert.deepEqual(fetchedUrls, []);
  });

  it("still draws a banner letterhead with its own graphic", async () => {
    officeRow = officeBanner;

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.letterhead?.layout, "banner");
    assert.equal(decode(resolved.logo), OFFICE_BANNER);
  });
});

describe("getDocumentLetterheadOverview", () => {
  it("offers the copy while the default is selected", async () => {
    const overview = await getDocumentLetterheadOverview(
      PROJECT_ID,
      DOCUMENT_ID,
    );

    assert.equal(overview.selection, "default");
    assert.deepEqual(overview.letterhead, officeDefault);
    assert.deepEqual(overview.own, {
      referenceFilename: "blm-letter.pdf",
      version: "2026-10-20T10:00:00.123Z",
    });
  });

  it("returns the copy as the letterhead when it is selected", async () => {
    selectOwn();

    const overview = await getDocumentLetterheadOverview(
      PROJECT_ID,
      DOCUMENT_ID,
    );

    assert.equal(overview.selection, "own");
    assert.equal(overview.letterhead?.layout, "grid");
    assert.deepEqual(overview.letterhead?.nameLines, [
      "Bureau of Land Management",
    ]);
    assert.deepEqual(overview.defaultLetterhead, officeDefault);
    assert.deepEqual(overview.own, {
      referenceFilename: "blm-letter.pdf",
      version: "2026-10-20T10:00:00.123Z",
    });
    // Read once, even though both the selection and the offer need it.
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 1);
  });

  it("offers no copy for a document without one", async () => {
    ownRow = null;

    const overview = await getDocumentLetterheadOverview(
      PROJECT_ID,
      DOCUMENT_ID,
    );

    assert.equal(overview.own, null);
  });

  it("offers no copy for another project's document, without reading it", async () => {
    documentProjectId = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";

    const overview = await getDocumentLetterheadOverview(
      PROJECT_ID,
      DOCUMENT_ID,
    );

    assert.equal(overview.own, null);
    assert.equal(overview.selection, "default");
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("fetches no logo bytes", async () => {
    selectOwn();

    await getDocumentLetterheadOverview(PROJECT_ID, DOCUMENT_ID);

    assert.deepEqual(fetchedUrls, []);
    assert.deepEqual(readKeys, []);
  });
});

describe("resolveDocumentLetterheadLogo", () => {
  const withTwoLogos = () => {
    selectOwn();
    ownRow = {
      letterhead: {
        ...referenceGrid,
        cells: [logoCell(REFERENCE_SEAL, 0.85), ...referenceGrid.cells],
      },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };
  };

  it("fetches only the logo cell of the index, left to right", async () => {
    withTwoLogos();

    const seal = await resolveDocumentLetterheadLogo(
      PROJECT_ID,
      DOCUMENT_ID,
      1,
    );
    assert.equal(decode(seal), REFERENCE_SEAL);
    assert.deepEqual(readKeys, [REFERENCE_SEAL]);

    readKeys.length = 0;
    const first = await resolveDocumentLetterheadLogo(
      PROJECT_ID,
      DOCUMENT_ID,
      0,
    );
    assert.equal(decode(first), REFERENCE_LOGO);
    assert.deepEqual(readKeys, [REFERENCE_LOGO]);
    assert.deepEqual(fetchedUrls, []);
  });

  it("is null past a grid's last logo cell, and for a cell that fails", async () => {
    selectOwn();

    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 1),
      null,
    );
    assert.deepEqual(readKeys, []);
    assert.deepEqual(fetchedUrls, []);

    failingKeys.add(REFERENCE_LOGO);
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0),
      null,
    );
    assert.equal(fetchedUrls.includes(OFFICE_LOGO), false);
  });

  it("serves the office → org logo at index 0 of a grid without logo cells", async () => {
    selectOwn();
    ownRow = {
      letterhead: { ...referenceGrid, cells: referenceGrid.cells.slice(1) },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    assert.equal(
      decode(await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0)),
      OFFICE_LOGO,
    );
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 1),
      null,
    );
  });

  it("serves a grid default's logo cells", async () => {
    officeRow = { ...officeLegacy, documentLetterheadGrid: orgGrid };

    assert.equal(
      decode(await resolveDocumentLetterheadLogo(PROJECT_ID, undefined, 0)),
      GRID_DEFAULT_LOGO,
    );
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, undefined, 1),
      null,
    );
  });

  it("serves a legacy letterhead's single logo at index 0 only", async () => {
    assert.equal(
      decode(await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0)),
      OFFICE_LOGO,
    );
    fetchedUrls.length = 0;
    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 1),
      null,
    );
    assert.deepEqual(fetchedUrls, []);
  });

  it("serves nothing for a document without a letterhead", async () => {
    selectionRow = { letterheadId: null, useOwn: false };

    assert.equal(
      await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0),
      null,
    );
    assert.deepEqual(fetchedUrls, []);
  });

  it("never reads another project's document copy", async () => {
    withTwoLogos();
    documentProjectId = "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e";

    // The project's default (the office's legacy letterhead) instead.
    assert.equal(
      decode(await resolveDocumentLetterheadLogo(PROJECT_ID, DOCUMENT_ID, 0)),
      OFFICE_LOGO,
    );
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
  });
});

describe("logo reading", () => {
  it("reads grid logos by key, bounded to 5 MB and 5 s, never over HTTP", async () => {
    selectOwn();
    ownRow = {
      letterhead: {
        ...referenceGrid,
        cells: [logoCell(REFERENCE_SEAL, 0.85), ...referenceGrid.cells],
      },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

    assert.deepEqual(readKeys, [REFERENCE_LOGO, REFERENCE_SEAL]);
    assert.deepEqual(readOptions, [
      { maxBytes: 5 * 1024 * 1024, timeoutMs: 5000 },
      { maxBytes: 5 * 1024 * 1024, timeoutMs: 5000 },
    ]);
    assert.deepEqual(fetchedUrls, []);
  });

  it("drops a grid logo storage holds as anything but PNG or JPEG", async () => {
    selectOwn();
    typedKeys.set(REFERENCE_LOGO, "image/svg+xml");
    const warn = mock.method(console, "warn", () => {});
    try {
      const resolved = await resolveDocumentLetterhead(PROJECT_ID, DOCUMENT_ID);

      assert.equal(resolved.logo, null);
      assert.deepEqual(resolved.logos, [null]);
    } finally {
      warn.mock.restore();
    }
  });

  it("never follows a legacy logo's redirect, even from our storage", async () => {
    redirectingUrls.add(OFFICE_LOGO);

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.equal(resolved.logo, null);
    assert.deepEqual(fetchedUrls, [OFFICE_LOGO]);
    assert.equal(fetchInits[0]?.redirect, "manual");
    assert.deepEqual(readKeys, []);
  });

  it("gives no legacy logo, without throwing, when the fetch itself fails", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;

    const resolved = await resolveDocumentLetterhead(PROJECT_ID);

    assert.deepEqual(resolved.letterhead, officeDefault);
    assert.equal(resolved.logo, null);
  });

  it("reports an external logo once, and one on our host every time", async () => {
    const warn = mock.method(console, "warn", () => {});
    try {
      const external = "https://cdn.example.gov/seal-once.png";
      const ownHostBadKey = `${STORAGE}/letterheads//logo.png`;
      officeRow = { ...officeLegacy, documentLogoUrl: external };
      await resolveDocumentLetterhead(PROJECT_ID);
      await resolveDocumentLetterhead(PROJECT_ID);
      officeRow = { ...officeLegacy, documentLogoUrl: ownHostBadKey };
      await resolveDocumentLetterhead(PROJECT_ID);
      await resolveDocumentLetterhead(PROJECT_ID);

      const refusals = warn.mock.calls
        .map((call) => String(call.arguments[0]))
        .filter((line) => line.includes("refused"));
      assert.deepEqual(refusals, [
        "[branding] Image URL refused (not our storage):",
        "[branding] Image URL refused (storage host, no known key):",
        "[branding] Image URL refused (storage host, no known key):",
      ]);
      assert.deepEqual(fetchedUrls, []);
    } finally {
      warn.mock.restore();
    }
  });
});

describe("getProjectDocumentBranding with a grid letterhead", () => {
  const body = "# Letter\n\nDear Applicant,";

  it("hands over the public grid and its logos, content untouched", async () => {
    selectOwn();

    const branding = await getProjectDocumentBranding(
      PROJECT_ID,
      body,
      DOCUMENT_ID,
    );

    assert.equal(branding.content, body);
    assert.equal(branding.logo, null);
    assert.equal(branding.logoPlacement, undefined);
    assert.equal(branding.color, "#1f5f3a");
    assert.deepEqual(branding.gridLetterhead?.grid.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.15,
      index: 0,
    });
    assert.equal(
      JSON.stringify(branding.gridLetterhead?.grid).includes("letterheads/"),
      false,
    );
    assert.deepEqual(branding.gridLetterhead?.logos.map(decode), [
      REFERENCE_LOGO,
    ]);
  });

  it("keeps the office logo in the margin for a grid without logo cells", async () => {
    selectOwn();
    ownRow = {
      letterhead: { ...referenceGrid, cells: referenceGrid.cells.slice(1) },
      referenceFilename: "blm-letter.pdf",
      updatedAt: COPY_UPDATED_AT,
    };

    const branding = await getProjectDocumentBranding(
      PROJECT_ID,
      body,
      DOCUMENT_ID,
    );

    assert.equal(branding.content, body);
    assert.equal(decode(branding.logo), OFFICE_LOGO);
    assert.equal(branding.logoPlacement, "margin");
    assert.deepEqual(branding.gridLetterhead?.logos, []);
  });

  it("leaves a legacy letterhead as before", async () => {
    const branding = await getProjectDocumentBranding(PROJECT_ID, body);

    assert.equal(branding.gridLetterhead, null);
    assert.match(branding.content, /^\| \*\*Example Ranger District\*\* \|/);
    assert.equal(decode(branding.logo), OFFICE_LOGO);
  });

  it("goes out without a letterhead, keeping its footer, when resolution fails", async () => {
    const error = mock.method(console, "error", () => {});
    officeRow = { ...officeLegacy, documentFooterText: "Example footer" };
    getDocumentLetterheadSelectionRow.mock.mockImplementationOnce(async () => {
      throw new Error("db down: postgres://user:secret@host");
    });
    try {
      const branding = await getProjectDocumentBranding(
        PROJECT_ID,
        body,
        DOCUMENT_ID,
      );

      assert.equal(branding.content, body);
      assert.equal(branding.logo, null);
      assert.equal(branding.gridLetterhead, null);
      assert.equal(branding.footer.text, "Example footer");
      const logged = JSON.stringify(error.mock.calls.map((c) => c.arguments));
      assert.match(logged, /Letterhead resolution failed/);
      assert.equal(logged.includes("secret"), false);
    } finally {
      error.mock.restore();
    }
  });
});
