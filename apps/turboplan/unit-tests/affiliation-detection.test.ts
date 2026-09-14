import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import {
  OrganizationType,
  organizationUsers,
  UserRole,
} from "@wildfires-org/turboplan-db";
import type { OrganizationWithEmailDomains } from "@wildfires-org/turboplan-db/queries";

import type * as AffiliationModule from "../lib/affiliation-detection";

// --- Mutable per-test fixtures (read by the mock implementations below) ---
let orgsFixture: OrganizationWithEmailDomains[] = [];
let profileFixture: { userRole: UserRole | null } | null = null;

// --- Mocked db-query functions ---
const getActiveOrganizationsWithEmailDomains = mock.fn(
  async (): Promise<OrganizationWithEmailDomains[]> => orgsFixture,
);
const getProfileByUserId = mock.fn(
  async (_userId: string): Promise<{ userRole: UserRole | null } | null> =>
    profileFixture,
);
const updateProfile = mock.fn(
  async (_args: { userId: string; userRole: UserRole }): Promise<void> => {},
);

// --- Mocked db client: records the insert().values().onConflictDoNothing() chain ---
const onConflictDoNothing = mock.fn(async (): Promise<void> => {});
const values = mock.fn((_record: unknown) => ({ onConflictDoNothing }));
const insert = mock.fn((_table: unknown) => ({ values }));
const db = { insert };

// `server-only` throws when imported outside a React Server Component; stub it
// so the module-under-test (which starts with `import "server-only"`) can load.
mock.module("server-only", { namedExports: {} });

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    getActiveOrganizationsWithEmailDomains,
    getProfileByUserId,
    updateProfile,
  },
});
mock.module("@wildfires-org/turboplan-db/db-client", {
  namedExports: { db },
});

// The turboplan app resolves as CJS (no "type": "module"), so top-level await
// is unavailable — import the module-under-test in a `before` hook instead,
// after the mocks above are registered.
let affiliation: typeof AffiliationModule;

before(async () => {
  affiliation = await import("../lib/affiliation-detection");
});

// --- Org fixtures ---
const govOrg: OrganizationWithEmailDomains = {
  id: "gov-1",
  name: "US Forest Service",
  shortName: "USFS",
  slug: "usfs",
  type: OrganizationType.GOVERNMENT,
  emailDomains: ["usda.gov"],
};

const plannerOrg: OrganizationWithEmailDomains = {
  id: "env-1",
  name: "Jacobs Engineering",
  shortName: "Jacobs",
  slug: "jacobs",
  type: OrganizationType.ENVIRONMENTAL_PLANNER,
  emailDomains: ["jacobs.com"],
};

beforeEach(() => {
  orgsFixture = [];
  profileFixture = null;
  getActiveOrganizationsWithEmailDomains.mock.resetCalls();
  getProfileByUserId.mock.resetCalls();
  updateProfile.mock.resetCalls();
  insert.mock.resetCalls();
  values.mock.resetCalls();
  onConflictDoNothing.mock.resetCalls();
});

describe("findAffiliatedOrgForEmail", () => {
  it("returns null for a null email without querying orgs", async () => {
    const result = await affiliation.findAffiliatedOrgForEmail(null);
    assert.strictEqual(result, null);
    assert.strictEqual(
      getActiveOrganizationsWithEmailDomains.mock.callCount(),
      0,
    );
  });

  it("returns null for an undefined email", async () => {
    const result = await affiliation.findAffiliatedOrgForEmail(undefined);
    assert.strictEqual(result, null);
    assert.strictEqual(
      getActiveOrganizationsWithEmailDomains.mock.callCount(),
      0,
    );
  });

  it("returns null for an empty-string email", async () => {
    const result = await affiliation.findAffiliatedOrgForEmail("");
    assert.strictEqual(result, null);
    assert.strictEqual(
      getActiveOrganizationsWithEmailDomains.mock.callCount(),
      0,
    );
  });

  it("returns null when no org domain matches", async () => {
    orgsFixture = [govOrg, plannerOrg];
    const result = await affiliation.findAffiliatedOrgForEmail(
      "someone@example.com",
    );
    assert.strictEqual(result, null);
  });

  it("returns the government org on a single government match", async () => {
    orgsFixture = [govOrg];
    const result =
      await affiliation.findAffiliatedOrgForEmail("ranger@usda.gov");
    assert.strictEqual(result, govOrg);
  });

  it("returns the planner org on a single environmental-planner match", async () => {
    orgsFixture = [plannerOrg];
    const result =
      await affiliation.findAffiliatedOrgForEmail("planner@jacobs.com");
    assert.strictEqual(result, plannerOrg);
  });

  it("prefers a government org over a planner org sharing the domain, even when the planner is listed first", async () => {
    const sharedPlanner: OrganizationWithEmailDomains = {
      ...plannerOrg,
      id: "env-shared",
      emailDomains: ["shared.example"],
    };
    const sharedGov: OrganizationWithEmailDomains = {
      ...govOrg,
      id: "gov-shared",
      emailDomains: ["shared.example"],
    };
    orgsFixture = [sharedPlanner, sharedGov];

    const result = await affiliation.findAffiliatedOrgForEmail(
      "user@shared.example",
    );
    assert.strictEqual(result, sharedGov);
  });

  it("returns the first match when two planners share the domain", async () => {
    const firstPlanner: OrganizationWithEmailDomains = {
      ...plannerOrg,
      id: "env-first",
      emailDomains: ["consult.example"],
    };
    const secondPlanner: OrganizationWithEmailDomains = {
      ...plannerOrg,
      id: "env-second",
      emailDomains: ["consult.example"],
    };
    orgsFixture = [firstPlanner, secondPlanner];

    const result = await affiliation.findAffiliatedOrgForEmail(
      "user@consult.example",
    );
    assert.strictEqual(result, firstPlanner);
  });
});

describe("resolveAffiliation", () => {
  it("returns citizen + null for a null email", async () => {
    const result = await affiliation.resolveAffiliation(null);
    assert.deepStrictEqual(result, { role: UserRole.CITIZEN, org: null });
  });

  it("returns citizen + null when no org matches", async () => {
    orgsFixture = [govOrg, plannerOrg];
    const result = await affiliation.resolveAffiliation("nobody@example.com");
    assert.deepStrictEqual(result, { role: UserRole.CITIZEN, org: null });
  });

  it("maps a government match to government_agency", async () => {
    orgsFixture = [govOrg];
    const result = await affiliation.resolveAffiliation("ranger@usda.gov");
    assert.strictEqual(result.role, UserRole.GOVERNMENT_AGENCY);
    assert.strictEqual(result.org, govOrg);
  });

  it("maps an environmental-planner match to environmental_planning", async () => {
    orgsFixture = [plannerOrg];
    const result = await affiliation.resolveAffiliation("planner@jacobs.com");
    assert.strictEqual(result.role, UserRole.ENVIRONMENTAL_PLANNING);
    assert.strictEqual(result.org, plannerOrg);
  });

  it("prefers the government role in a multi-match", async () => {
    const sharedPlanner: OrganizationWithEmailDomains = {
      ...plannerOrg,
      id: "env-shared",
      emailDomains: ["shared.example"],
    };
    const sharedGov: OrganizationWithEmailDomains = {
      ...govOrg,
      id: "gov-shared",
      emailDomains: ["shared.example"],
    };
    orgsFixture = [sharedPlanner, sharedGov];

    const result = await affiliation.resolveAffiliation("user@shared.example");
    assert.strictEqual(result.role, UserRole.GOVERNMENT_AGENCY);
    assert.strictEqual(result.org, sharedGov);
  });
});

describe("isRoleUpgradeAllowed", () => {
  it("allows an upgrade for a null current role", () => {
    assert.strictEqual(affiliation.isRoleUpgradeAllowed(null), true);
  });

  it("allows an upgrade for an undefined current role", () => {
    assert.strictEqual(affiliation.isRoleUpgradeAllowed(undefined), true);
  });

  it("allows an upgrade for a citizen", () => {
    assert.strictEqual(
      affiliation.isRoleUpgradeAllowed(UserRole.CITIZEN),
      true,
    );
  });

  it("blocks an upgrade for government_agency", () => {
    assert.strictEqual(
      affiliation.isRoleUpgradeAllowed(UserRole.GOVERNMENT_AGENCY),
      false,
    );
  });

  it("blocks an upgrade for environmental_planning", () => {
    assert.strictEqual(
      affiliation.isRoleUpgradeAllowed(UserRole.ENVIRONMENTAL_PLANNING),
      false,
    );
  });

  it("allows only citizen (and no-role) across every UserRole value", () => {
    for (const role of Object.values(UserRole)) {
      const expected = role === UserRole.CITIZEN;
      assert.strictEqual(
        affiliation.isRoleUpgradeAllowed(role),
        expected,
        `role="${role}"`,
      );
    }
  });
});

describe("ensureOrganizationViewerMembership", () => {
  it("inserts a viewer membership with onConflictDoNothing", async () => {
    await affiliation.ensureOrganizationViewerMembership("user-1", "org-1");

    assert.strictEqual(insert.mock.callCount(), 1);
    assert.strictEqual(insert.mock.calls[0].arguments[0], organizationUsers);

    assert.strictEqual(values.mock.callCount(), 1);
    assert.deepStrictEqual(values.mock.calls[0].arguments[0], {
      userId: "user-1",
      organizationId: "org-1",
      role: "viewer",
    });

    assert.strictEqual(onConflictDoNothing.mock.callCount(), 1);
  });

  it("relies on onConflictDoNothing for idempotency on repeated calls", async () => {
    await affiliation.ensureOrganizationViewerMembership("user-1", "org-1");
    await affiliation.ensureOrganizationViewerMembership("user-1", "org-1");

    assert.strictEqual(insert.mock.callCount(), 2);
    assert.strictEqual(onConflictDoNothing.mock.callCount(), 2);
  });
});

describe("syncAffiliation", () => {
  it("does nothing when the email matches no org", async () => {
    orgsFixture = [govOrg, plannerOrg];
    await affiliation.syncAffiliation("user-1", "nobody@example.com");

    assert.strictEqual(getProfileByUserId.mock.callCount(), 0);
    assert.strictEqual(updateProfile.mock.callCount(), 0);
    assert.strictEqual(insert.mock.callCount(), 0);
  });

  it("upgrades a citizen and ensures viewer membership on a match", async () => {
    orgsFixture = [govOrg];
    profileFixture = { userRole: UserRole.CITIZEN };

    await affiliation.syncAffiliation("user-1", "ranger@usda.gov");

    assert.strictEqual(updateProfile.mock.callCount(), 1);
    assert.deepStrictEqual(updateProfile.mock.calls[0].arguments[0], {
      userId: "user-1",
      userRole: UserRole.GOVERNMENT_AGENCY,
    });

    assert.strictEqual(insert.mock.callCount(), 1);
    assert.deepStrictEqual(values.mock.calls[0].arguments[0], {
      userId: "user-1",
      organizationId: govOrg.id,
      role: "viewer",
    });
  });

  it("does NOT re-write an already-elevated role but STILL ensures membership", async () => {
    orgsFixture = [plannerOrg];
    profileFixture = { userRole: UserRole.GOVERNMENT_AGENCY };

    await affiliation.syncAffiliation("user-1", "planner@jacobs.com");

    assert.strictEqual(updateProfile.mock.callCount(), 0);
    assert.strictEqual(insert.mock.callCount(), 1);
    assert.deepStrictEqual(values.mock.calls[0].arguments[0], {
      userId: "user-1",
      organizationId: plannerOrg.id,
      role: "viewer",
    });
  });

  it("upgrades when the profile is null (no existing role)", async () => {
    orgsFixture = [plannerOrg];
    profileFixture = null;

    await affiliation.syncAffiliation("user-1", "planner@jacobs.com");

    assert.strictEqual(updateProfile.mock.callCount(), 1);
    assert.deepStrictEqual(updateProfile.mock.calls[0].arguments[0], {
      userId: "user-1",
      userRole: UserRole.ENVIRONMENTAL_PLANNING,
    });
    assert.strictEqual(insert.mock.callCount(), 1);
  });
});
