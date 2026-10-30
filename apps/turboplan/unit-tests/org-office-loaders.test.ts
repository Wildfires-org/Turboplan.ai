import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

import type * as OfficesModule from "../lib/cache/offices";
import type * as OrganizationsModule from "../lib/cache/organizations";
import type * as ProjectsModule from "../lib/cache/projects";

// The slug loaders hand organization and office rows to the pages, which pass
// them on to client components: a row's default letterhead grid (storage keys
// in its logo cells) must never be among them.

const USER_ID = "0a7c9d2e-9999-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-4444-4c3b-8d2e-3f4a5b6c7d8e";
const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const GRID_LOGO = "letterheads/project/doc/logo-0-abc.png";

const storedGrid = {
  cells: [{ kind: "logo", x: 0, width: 0.2, height: 0.2, key: GRID_LOGO }],
  color: null,
};

const organizationRow = {
  id: ORGANIZATION_ID,
  name: "Example Agency",
  slug: "example-agency",
  type: "government",
  documentLetterheadColor: "#1f5f3a",
  documentLetterheadGrid: storedGrid,
};
const officeRow = {
  id: OFFICE_ID,
  name: "Example District",
  slug: "example-district",
  organizationId: ORGANIZATION_ID,
  documentLetterheadLines: "Example District",
  documentLetterheadGrid: storedGrid,
};
const projectRow = {
  id: PROJECT_ID,
  name: "Example Project",
  slug: "example-project",
  officeId: OFFICE_ID,
  isPublic: false,
  coverImageId: null,
};

mock.module("server-only", { namedExports: {} });
mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: {
    getOrganizationBySlug: async () => ({
      entity: organizationRow,
      foundViaHistory: false,
    }),
    getOfficeBySlug: async () => ({
      entity: officeRow,
      foundViaHistory: false,
    }),
    getProjectBySlug: async () => ({
      entity: projectRow,
      foundViaHistory: false,
    }),
    getProjectById: async () => projectRow,
    getProjectsByOffice: async () => [],
    isDraftHiddenFromUser: () => false,
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async () => ({ allowed: true }),
      getAllowedActions: async () => ({ actions: [] }),
    }),
  },
});
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: { getGeneratedImageById: async () => null },
});

// The turboplan app resolves as CJS (no top-level await): the modules under
// test are imported once the mocks above are registered.
let organizations: typeof OrganizationsModule;
let offices: typeof OfficesModule;
let projects: typeof ProjectsModule;

before(async () => {
  organizations = await import("../lib/cache/organizations");
  offices = await import("../lib/cache/offices");
  projects = await import("../lib/cache/projects");
});

// Neither the grid's key nor its URL, anywhere in what a page would pass on.
const assertNoGrid = (value: unknown) => {
  const text = JSON.stringify(value);
  assert.equal(text.includes("documentLetterheadGrid"), false, text);
  assert.equal(text.includes(GRID_LOGO), false, text);
};

describe("organization and office loaders", () => {
  it("getCachedOrganizationBySlug drops the organization's grid", async () => {
    const { entity } =
      await organizations.getCachedOrganizationBySlug("example-agency");

    assertNoGrid(entity);
    assert.equal(entity?.documentLetterheadColor, "#1f5f3a");
  });

  it("getValidatedOrganizationBySlug drops the organization's grid", async () => {
    const { data } = await organizations.getValidatedOrganizationBySlug(
      USER_ID,
      "example-agency",
    );

    assert.equal(data?.id, ORGANIZATION_ID);
    assertNoGrid(data);
  });

  it("getCachedOfficeBySlug drops the office's grid", async () => {
    const { entity } = await offices.getCachedOfficeBySlug(
      "example-agency",
      "example-district",
    );

    assertNoGrid(entity);
    assert.equal(entity?.documentLetterheadLines, "Example District");
  });

  it("getValidatedOfficeBySlug drops both grids", async () => {
    const { data } = await offices.getValidatedOfficeBySlug(
      USER_ID,
      "example-agency",
      "example-district",
    );

    assert.equal(data?.office.id, OFFICE_ID);
    assert.equal(data?.organization.id, ORGANIZATION_ID);
    assertNoGrid(data);
  });

  it("getValidatedProjectBySlug drops both grids", async () => {
    const { data } = await projects.getValidatedProjectBySlug(
      USER_ID,
      "example-agency",
      "example-district",
      "example-project",
    );

    assert.equal(data?.project.id, PROJECT_ID);
    assert.equal(data?.office.id, OFFICE_ID);
    assertNoGrid(data);
  });
});
