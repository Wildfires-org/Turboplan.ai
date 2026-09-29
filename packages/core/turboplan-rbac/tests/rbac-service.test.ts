import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

import { Action, EntityType } from "../src/types";

const isAdmin = mock.fn(async () => true);

mock.module("@wildfires-org/turboplan-db/db-client", {
  namedExports: { getDB: () => ({}) },
});

mock.module("../src/utils/admin-server", {
  namedExports: { isAdmin },
});

mock.module("../src/services/membership.service", {
  namedExports: {
    DrizzleMembershipService: class {
      getUserMemberships = async () => [];
    },
  },
});

mock.module("../src/services/entity-hierarchy.service", {
  namedExports: {
    DrizzleEntityHierarchyService: class {
      getAncestors = async () => [];
      getAncestorsBatch = async () => new Map();
    },
  },
});

const { RBACService } = await import("../src/services/rbac.service");

const check = (service: InstanceType<typeof RBACService>) =>
  service.checkPermission(
    "user-1",
    "project-1",
    EntityType.PROJECT,
    Action.DELETE,
    { email: "admin@example.test" },
  );

beforeEach(() => {
  isAdmin.mock.resetCalls();
});

describe("RBACService platformAdminBypass", () => {
  it("grants a platform admin every action by default", async () => {
    const result = await check(new RBACService());

    assert.equal(result.allowed, true);
    assert.equal(result.reason, "Platform admin");
    assert.equal(isAdmin.mock.callCount(), 1);
  });

  it("judges an admin on memberships alone when the bypass is off", async () => {
    const result = await check(
      new RBACService(undefined, { platformAdminBypass: false }),
    );

    assert.equal(result.allowed, false);
    assert.equal(isAdmin.mock.callCount(), 0);
  });
});
