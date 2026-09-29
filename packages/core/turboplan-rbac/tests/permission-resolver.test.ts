import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMembershipGrant,
  PermissionResolver,
} from "../src/permission-resolver";
import type {
  EntityHierarchyService,
  EntityMetadata,
  Membership,
  MembershipService,
} from "../src/types";
import { Action, EntityType, MemberRole } from "../src/types";

const ORG = "org-1";
const OFFICE = "office-1";
const PROJECT = "project-1";
const USER = "user-1";

const ancestorsOf: Record<string, EntityMetadata[]> = {
  [PROJECT]: [
    { id: OFFICE, type: EntityType.OFFICE },
    { id: ORG, type: EntityType.ORGANIZATION },
  ],
  [OFFICE]: [{ id: ORG, type: EntityType.ORGANIZATION }],
  [ORG]: [],
};

type Harness = {
  resolver: PermissionResolver;
  calls: string[];
  /** Resolves each pending lookup; used to prove they were issued together. */
  release: () => void;
};

/**
 * Builds a resolver over stub services that record call order and, when
 * `gate` is set, hold every lookup until `release()` — so a test can assert
 * which lookups were issued before any of them resolved. Lookups issued after
 * `release()` resolve immediately, so a resolver that defers a lookup until an
 * earlier one settles still completes.
 */
const createHarness = (
  memberships: Membership[],
  options: { admin?: boolean; withAdminCheck?: boolean; gate?: boolean } = {},
): Harness => {
  const calls: string[] = [];
  const pending: Array<() => void> = [];
  let released = false;
  const gate = <T>(value: T): Promise<T> =>
    options.gate && !released
      ? new Promise<T>((resolve) => {
          pending.push(() => resolve(value));
        })
      : Promise.resolve(value);

  const membershipService = {
    getUserMemberships: async (userId: string) => {
      calls.push(`memberships:${userId}`);
      return gate(memberships);
    },
  } as unknown as MembershipService;

  const entityHierarchyService = {
    getAncestors: async (entityId: string) => {
      calls.push(`ancestors:${entityId}`);
      return gate(ancestorsOf[entityId] ?? []);
    },
    getAncestorsBatch: async (
      entities: Array<{ entityId: string; entityType: string }>,
    ) => {
      calls.push(`ancestorsBatch:${entities.map((e) => e.entityId).join(",")}`);
      // Keyed by entity id, matching DrizzleEntityHierarchyService.
      const map = new Map<string, EntityMetadata[]>();
      for (const e of entities) {
        map.set(e.entityId, ancestorsOf[e.entityId] ?? []);
      }
      return gate(map);
    },
  } as unknown as EntityHierarchyService;

  const resolver = new PermissionResolver({
    membershipService,
    entityHierarchyService,
    adminCheck:
      options.withAdminCheck === false
        ? undefined
        : async (userId: string) => {
            calls.push(`admin:${userId}`);
            return gate(options.admin ?? false);
          },
  });

  return {
    resolver,
    calls,
    release: () => {
      released = true;
      for (const resolve of pending.splice(0)) {
        resolve();
      }
    },
  };
};

const membership = (
  entityId: string,
  entityType: Membership["entityType"],
  role: Membership["role"],
): Membership =>
  ({ userId: USER, entityId, entityType, role }) as unknown as Membership;

describe("PermissionResolver.checkPermission", () => {
  it("issues the admin and membership lookups in one parallel round", async () => {
    const h = createHarness(
      [membership(ORG, EntityType.ORGANIZATION, MemberRole.EDITOR)],
      { gate: true },
    );

    const result = h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.UPDATE,
    );

    // Both were requested before either resolved; the ancestor lookup waits
    // until the cheap decisive paths have been ruled out.
    await Promise.resolve();
    assert.deepEqual(h.calls, [`admin:${USER}`, `memberships:${USER}`]);

    h.release();
    const resolved = await result;
    assert.deepEqual(h.calls, [
      `admin:${USER}`,
      `memberships:${USER}`,
      `ancestors:${PROJECT}`,
    ]);
    assert.equal(resolved.allowed, true);
    assert.equal(resolved.effectiveRole, MemberRole.EDITOR);
    assert.equal(resolved.reason, "Inherited permission from parent entity");
  });

  it("skips the ancestor lookup when a direct membership grants the action", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.EDITOR),
    ]);

    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.UPDATE,
    );

    assert.equal(result.allowed, true);
    assert.equal(result.reason, "Direct membership permission");
    assert.ok(!h.calls.some((c) => c.startsWith("ancestors:")));
  });

  it("platform admin short-circuits to OWNER without a hierarchy lookup", async () => {
    const h = createHarness([], { admin: true });
    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.MANAGE_MEMBERS,
    );
    assert.deepEqual(result, {
      allowed: true,
      reason: "Platform admin",
      effectiveRole: MemberRole.OWNER,
    });
    assert.ok(!h.calls.some((c) => c.startsWith("ancestors")));
  });

  it("works without an adminCheck configured", async () => {
    const h = createHarness(
      [membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER)],
      { withAdminCheck: false },
    );
    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.READ,
    );
    assert.equal(result.allowed, true);
    assert.equal(result.reason, "Direct membership permission");
    assert.ok(!h.calls.some((c) => c.startsWith("admin:")));
  });

  it("direct membership wins over inheritance and reports its own role", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
      membership(ORG, EntityType.ORGANIZATION, MemberRole.OWNER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.READ,
    );
    assert.equal(result.effectiveRole, MemberRole.VIEWER);
    assert.equal(result.reason, "Direct membership permission");
  });

  it("direct membership lacking the action falls through to an inherited role", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
      membership(ORG, EntityType.ORGANIZATION, MemberRole.OWNER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.DELETE,
    );
    assert.equal(result.allowed, true);
    assert.equal(result.effectiveRole, MemberRole.OWNER);
    assert.equal(result.reason, "Inherited permission from parent entity");
  });

  it("grants upward READ on an organization from a child project membership", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      ORG,
      EntityType.ORGANIZATION,
      Action.READ,
    );
    assert.equal(result.allowed, true);
    assert.equal(result.reason, "Upward read access from child entity");
    assert.equal(result.effectiveRole, MemberRole.VIEWER);
    assert.ok(h.calls.includes(`ancestorsBatch:${PROJECT}`));
  });

  it("does not grant upward access for non-READ actions", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      ORG,
      EntityType.ORGANIZATION,
      Action.UPDATE,
    );
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "No permission found");
    assert.ok(!h.calls.some((c) => c.startsWith("ancestorsBatch:")));
  });

  it("denies with the canonical reason when nothing matches", async () => {
    const h = createHarness([]);
    const result = await h.resolver.checkPermission(
      USER,
      PROJECT,
      EntityType.PROJECT,
      Action.READ,
    );
    assert.deepEqual(result, { allowed: false, reason: "No permission found" });
  });
});

describe("PermissionResolver.getEffectiveRole", () => {
  it("fetches memberships and ancestors together and returns the highest role", async () => {
    const h = createHarness(
      [
        membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
        membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR),
      ],
      { gate: true },
    );
    const pending = h.resolver.getEffectiveRole(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );
    await Promise.resolve();
    assert.deepEqual(h.calls, [`memberships:${USER}`, `ancestors:${PROJECT}`]);
    h.release();
    assert.equal(await pending, MemberRole.EDITOR);
  });

  it("returns null with no memberships", async () => {
    const h = createHarness([]);
    assert.equal(
      await h.resolver.getEffectiveRole(USER, ORG, EntityType.ORGANIZATION),
      null,
    );
  });
});

describe("PermissionResolver.getAllowedActions", () => {
  it("issues the admin and membership lookups in one parallel round, then one ancestor lookup", async () => {
    const h = createHarness(
      [membership(ORG, EntityType.ORGANIZATION, MemberRole.EDITOR)],
      { gate: true },
    );

    const pending = h.resolver.getAllowedActions(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );

    await Promise.resolve();
    assert.deepEqual(h.calls, [`admin:${USER}`, `memberships:${USER}`]);

    h.release();
    const result = await pending;
    // One ancestor lookup total, reused across all five actions.
    assert.deepEqual(h.calls, [
      `admin:${USER}`,
      `memberships:${USER}`,
      `ancestors:${PROJECT}`,
    ]);
    assert.deepEqual(result.actions, [
      Action.CREATE,
      Action.READ,
      Action.UPDATE,
    ]);
    assert.equal(result.effectiveRole, MemberRole.EDITOR);
  });

  it("grants a platform admin every action as owner", async () => {
    const h = createHarness([], { admin: true });
    const result = await h.resolver.getAllowedActions(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );
    assert.deepEqual(result.actions, Object.values(Action));
    assert.equal(result.effectiveRole, MemberRole.OWNER);
  });

  it("unions a direct viewer role with a higher ancestor role", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
      membership(ORG, EntityType.ORGANIZATION, MemberRole.OWNER),
    ]);
    const result = await h.resolver.getAllowedActions(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );
    assert.deepEqual(result.actions, Object.values(Action));
    assert.ok(result.actions.includes(Action.DELETE));
    assert.ok(result.actions.includes(Action.MANAGE_MEMBERS));
    assert.equal(result.effectiveRole, MemberRole.OWNER);
  });

  it("resolves an inherited-only editor role without a direct membership", async () => {
    const h = createHarness([
      membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR),
    ]);
    const result = await h.resolver.getAllowedActions(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );
    assert.deepEqual(result.actions, [
      Action.CREATE,
      Action.READ,
      Action.UPDATE,
    ]);
    assert.equal(result.effectiveRole, MemberRole.EDITOR);
  });

  it("adds upward READ from a child project without inventing a role", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
    ]);
    const result = await h.resolver.getAllowedActions(
      USER,
      ORG,
      EntityType.ORGANIZATION,
    );
    assert.deepEqual(result.actions, [Action.READ]);
    assert.equal(result.effectiveRole, null);
    assert.ok(h.calls.includes(`ancestorsBatch:${PROJECT}`));
  });

  it("skips the upward lookup when a role already grants READ", async () => {
    const h = createHarness([
      membership(ORG, EntityType.ORGANIZATION, MemberRole.VIEWER),
    ]);
    const result = await h.resolver.getAllowedActions(
      USER,
      ORG,
      EntityType.ORGANIZATION,
    );
    assert.deepEqual(result.actions, [Action.READ]);
    assert.equal(result.effectiveRole, MemberRole.VIEWER);
    assert.ok(!h.calls.some((c) => c.startsWith("ancestorsBatch:")));
  });

  it("returns no actions and no role when nothing matches", async () => {
    const h = createHarness([]);
    const result = await h.resolver.getAllowedActions(
      USER,
      PROJECT,
      EntityType.PROJECT,
    );
    assert.deepEqual(result, { actions: [], effectiveRole: null });
  });

  it("agrees with checkPermission for every action across fixtures", async () => {
    const fixtures: Array<{
      name: string;
      memberships: Membership[];
      entityId: string;
      entityType: Membership["entityType"];
      admin?: boolean;
    }> = [
      {
        name: "admin",
        memberships: [],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
        admin: true,
      },
      {
        name: "direct viewer + ancestor owner",
        memberships: [
          membership(PROJECT, EntityType.PROJECT, MemberRole.VIEWER),
          membership(ORG, EntityType.ORGANIZATION, MemberRole.OWNER),
        ],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
      },
      {
        name: "inherited editor",
        memberships: [membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR)],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
      },
      {
        name: "upward read on org",
        memberships: [
          membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
        ],
        entityId: ORG,
        entityType: EntityType.ORGANIZATION,
      },
      {
        name: "upward read on office",
        memberships: [
          membership(PROJECT, EntityType.PROJECT, MemberRole.EDITOR),
        ],
        entityId: OFFICE,
        entityType: EntityType.OFFICE,
      },
      {
        name: "direct owner above ancestor viewer",
        memberships: [
          membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
          membership(ORG, EntityType.ORGANIZATION, MemberRole.VIEWER),
        ],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
      },
      {
        name: "two ancestors with different roles",
        memberships: [
          membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR),
          membership(ORG, EntityType.ORGANIZATION, MemberRole.VIEWER),
        ],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
      },
      {
        name: "no memberships",
        memberships: [],
        entityId: PROJECT,
        entityType: EntityType.PROJECT,
      },
    ];

    for (const fixture of fixtures) {
      const allowedHarness = createHarness(fixture.memberships, {
        admin: fixture.admin,
      });
      const { actions } = await allowedHarness.resolver.getAllowedActions(
        USER,
        fixture.entityId,
        fixture.entityType,
      );

      for (const action of Object.values(Action)) {
        const checkHarness = createHarness(fixture.memberships, {
          admin: fixture.admin,
        });
        const { allowed } = await checkHarness.resolver.checkPermission(
          USER,
          fixture.entityId,
          fixture.entityType,
          action,
        );
        assert.equal(
          actions.includes(action),
          allowed,
          `${fixture.name} / ${action}`,
        );
      }
    }
  });
});

describe("PermissionResolver.getAllowedActionsBatch", () => {
  const PAGE_ENTITIES = [
    { entityId: ORG, entityType: EntityType.ORGANIZATION },
    { entityId: OFFICE, entityType: EntityType.OFFICE },
    { entityId: PROJECT, entityType: EntityType.PROJECT },
  ];

  it("resolves every entity from one admin check, one membership lookup and one batched ancestor query", async () => {
    const h = createHarness([
      membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR),
    ]);

    const results = await h.resolver.getAllowedActionsBatch(
      USER,
      PAGE_ENTITIES,
    );

    assert.equal(h.calls.filter((c) => c.startsWith("admin:")).length, 1);
    assert.equal(h.calls.filter((c) => c.startsWith("memberships:")).length, 1);
    assert.ok(h.calls.includes(`ancestorsBatch:${ORG},${OFFICE},${PROJECT}`));
    // No per-entity ancestor lookups — the batch covers all three.
    assert.ok(!h.calls.some((c) => c.startsWith("ancestors:")));

    assert.deepEqual(results.length, 3);
    assert.deepEqual(results[1], {
      actions: [Action.CREATE, Action.READ, Action.UPDATE],
      effectiveRole: MemberRole.EDITOR,
    });
  });

  it("matches getAllowedActions entity by entity", async () => {
    const memberships = [
      membership(OFFICE, EntityType.OFFICE, MemberRole.EDITOR),
      membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
    ];

    const batch = await createHarness(
      memberships,
    ).resolver.getAllowedActionsBatch(USER, PAGE_ENTITIES);

    for (const [index, entity] of PAGE_ENTITIES.entries()) {
      const single = await createHarness(
        memberships,
      ).resolver.getAllowedActions(USER, entity.entityId, entity.entityType);
      assert.deepEqual(batch[index], single, entity.entityType);
    }
  });

  it("grants a platform admin every action on every entity without hierarchy lookups", async () => {
    const h = createHarness([], { admin: true });

    const results = await h.resolver.getAllowedActionsBatch(
      USER,
      PAGE_ENTITIES,
    );

    for (const result of results) {
      assert.deepEqual(result, {
        actions: Object.values(Action),
        effectiveRole: MemberRole.OWNER,
      });
    }
    assert.ok(!h.calls.some((c) => c.startsWith("ancestors")));
  });
});

describe("isMembershipGrant", () => {
  it("is false for office READ reached only through a child project", async () => {
    const h = createHarness([
      membership(PROJECT, EntityType.PROJECT, MemberRole.OWNER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      OFFICE,
      EntityType.OFFICE,
      Action.READ,
    );
    assert.equal(result.allowed, true);
    assert.equal(isMembershipGrant(result), false);
  });

  it("is true for office READ inherited from an organization role", async () => {
    const h = createHarness([
      membership(ORG, EntityType.ORGANIZATION, MemberRole.VIEWER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      OFFICE,
      EntityType.OFFICE,
      Action.READ,
    );
    assert.equal(isMembershipGrant(result), true);
  });

  it("is true for a direct office role", async () => {
    const h = createHarness([
      membership(OFFICE, EntityType.OFFICE, MemberRole.VIEWER),
    ]);
    const result = await h.resolver.checkPermission(
      USER,
      OFFICE,
      EntityType.OFFICE,
      Action.READ,
    );
    assert.equal(isMembershipGrant(result), true);
  });

  it("is false for a denial", () => {
    assert.equal(isMembershipGrant({ allowed: false }), false);
  });
});
