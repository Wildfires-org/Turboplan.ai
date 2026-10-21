import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Hono } from "hono";

// An office's or organization's default letterhead grid holds storage keys
// (its logo cells): no payload that sends one of these rows may carry it.

const USER_ID = "0a7c9d2e-9999-4c3b-8d2e-3f4a5b6c7d8e";
const ORGANIZATION_ID = "0a7c9d2e-3333-4c3b-8d2e-3f4a5b6c7d8e";
const OFFICE_ID = "0a7c9d2e-4444-4c3b-8d2e-3f4a5b6c7d8e";
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
  status: "active",
  documentLetterheadGrid: storedGrid,
};
const officeRow = {
  id: OFFICE_ID,
  name: "Example District",
  slug: "example-district",
  organizationId: ORGANIZATION_ID,
  status: "active",
  documentLetterheadGrid: storedGrid,
};

// Every query builder chain resolves to no rows; `select` records what it
// was asked to select.
const selections: Record<string, unknown>[] = [];
const chain = (): unknown =>
  new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === "then"
        ? (resolve: (rows: unknown[]) => void) => resolve([])
        : () => chain(),
  });
const actualDbClient = await import("@wildfires-org/turboplan-db/db-client");
mock.module("@wildfires-org/turboplan-db/db-client", {
  namedExports: {
    ...actualDbClient,
    db: {
      select: (fields: Record<string, unknown>) => {
        selections.push(fields);
        return chain();
      },
    },
  },
});

const passThrough = () => async (_c: unknown, next: () => Promise<void>) => {
  await next();
};
const actualRbacHono = await import("@wildfires-org/turboplan-rbac/hono");
mock.module("@wildfires-org/turboplan-rbac/hono", {
  namedExports: {
    ...actualRbacHono,
    requirePermission: passThrough,
    requireMemberPermission: passThrough,
    getRBACServiceForRequest: () => ({
      checkPermission: async () => ({ allowed: true }),
    }),
  },
});

const actualOrganizationQueries = await import(
  "../src/server/organizations/queries"
);
mock.module("../src/server/organizations/queries", {
  namedExports: {
    ...actualOrganizationQueries,
    getUserAccessibleOrganizations: async () => [organizationRow],
    getGovernmentOrganizations: async () => [
      organizationRow,
      { ...organizationRow, id: "0a7c9d2e-5555-4c3b-8d2e-3f4a5b6c7d8e" },
    ],
    getOrganizationById: async () => organizationRow,
    getOrganizationBySlug: async () => ({
      entity: organizationRow,
      foundViaHistory: false,
    }),
  },
});

const actualOfficeQueries = await import("../src/server/offices/queries");
mock.module("../src/server/offices/queries", {
  namedExports: {
    ...actualOfficeQueries,
    getUserAccessibleOffices: async () => [officeRow],
    getOfficeWithRelations: async () => ({
      office: officeRow,
      organization: organizationRow,
      creator: { id: USER_ID },
    }),
  },
});

const { organizationsRouter } = await import(
  "../src/server/routes/organizations"
);
const { officesRouter } = await import("../src/server/routes/offices");
const { getProjectWithRelations } = await import(
  "../src/server/projects/queries"
);
const { getUserOrganizationsWithRoles } = await import(
  "../src/server/organizations/organization_users_queries"
);

const app = new Hono();
app.use("*", async (c, next) => {
  c.set("user" as never, { userId: USER_ID } as never);
  await next();
});
app.route("/api/organizations", organizationsRouter);
app.route("/api/offices", officesRouter);

// The response body, checked for the grid: neither its field nor a logo key.
const bodyOf = async (path: string) => {
  const res = await app.request(path);
  assert.equal(res.status, 200, path);
  const text = await res.text();
  assert.equal(text.includes("documentLetterheadGrid"), false, path);
  assert.equal(text.includes(GRID_LOGO), false, path);
  return JSON.parse(text);
};

describe("organization and office payloads", () => {
  it("GET /api/organizations lists organizations without their grid", async () => {
    const body = await bodyOf("/api/organizations");

    assert.equal(body.length, 2);
    assert.equal(body[0].name, "Example Agency");
  });

  it("GET /api/organizations/:id sends the organization without its grid", async () => {
    const body = await bodyOf(`/api/organizations/${ORGANIZATION_ID}`);

    assert.equal(body.id, ORGANIZATION_ID);
  });

  it("GET /api/offices lists offices without their grid", async () => {
    const body = await bodyOf("/api/offices?organizationSlug=example-agency");

    assert.equal(body[0].id, OFFICE_ID);
    assert.equal(body[0].projectCount, 0);
  });

  it("GET /api/offices/:id sends the office and its organization without grids", async () => {
    const body = await bodyOf(`/api/offices/${OFFICE_ID}`);

    assert.equal(body.office.id, OFFICE_ID);
    assert.equal(body.organization.id, ORGANIZATION_ID);
    assert.equal(body.creator.id, USER_ID);
  });

  it("getProjectWithRelations never selects the office's grid", async () => {
    selections.length = 0;

    await getProjectWithRelations("0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e");

    const [fields] = selections;
    const officeColumns = fields.office as Record<string, unknown>;
    assert.ok("organizationId" in officeColumns);
    assert.equal("documentLetterheadGrid" in officeColumns, false);
  });

  it("getUserOrganizationsWithRoles never selects the organization's grid", async () => {
    selections.length = 0;

    await getUserOrganizationsWithRoles(USER_ID);

    const [fields] = selections;
    const organizationColumns = fields.organization as Record<string, unknown>;
    assert.ok("documentLetterheadColor" in organizationColumns);
    assert.equal("documentLetterheadGrid" in organizationColumns, false);
  });
});
