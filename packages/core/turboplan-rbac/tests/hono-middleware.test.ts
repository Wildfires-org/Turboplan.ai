import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";
import { Hono, type MiddlewareHandler } from "hono";

import { Action, EntityType } from "../src/types";
import type {
  AuthMethod,
  RBACContext,
  RBACUserContext,
} from "../src/utils/hono-types";

type PermissionResult = {
  allowed: boolean;
  reason?: string;
  effectiveRole?: string;
};

// --- Mutable per-test state read by the mocked service/fallback below ---
let permissionFixture: PermissionResult = { allowed: true };
let permissionThrows: Error | null = null;
let publicGovFixture = false;
let publicGovCalls: { projectId: string; moduleName?: string }[] = [];
let rbacServiceOptions: unknown[] = [];

const checkPermission = mock.fn(async () => {
  if (permissionThrows) {
    throw permissionThrows;
  }
  return permissionFixture;
});

mock.module("../src/services/rbac.service", {
  namedExports: {
    getRBACService: (_db?: unknown, options?: unknown) => {
      rbacServiceOptions.push(options);
      return { checkPermission };
    },
  },
});

const isAdmin = mock.fn(async () => true);

mock.module("../src/utils/admin-server", {
  namedExports: { isAdmin },
});

mock.module("../src/utils/public-project-access", {
  namedExports: {
    isPublicGovProjectReadAllowed: async (
      projectId: string,
      options: { moduleName?: string } = {},
    ) => {
      publicGovCalls.push({ projectId, moduleName: options.moduleName });
      return publicGovFixture;
    },
  },
});

const {
  NO_PERMISSION_REASON,
  requireEntityPermission,
  requireEntityReadOrPublicGov,
  requireMemberPermission,
  requirePermission,
  isSessionAdmin,
} = await import("../src/utils/hono-middleware");
const { UPWARD_READ_REASON } = await import("../src/permission-resolver");

const USER: RBACUserContext = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "user@example.test",
};

/**
 * Mount `middleware` on `GET /entity/:id` and drive one request through it.
 * `user` is omitted to simulate an unauthenticated request.
 */
const run = async (
  middleware: MiddlewareHandler<RBACContext>,
  {
    user = USER as RBACUserContext | null,
    id = "row-1",
    authMethod = undefined as AuthMethod | undefined,
  } = {},
) => {
  const app = new Hono<RBACContext>();
  let handlerRan = false;
  let permissionResult: unknown = "UNSET";

  app.use("/entity/:id", async (c, next) => {
    if (user) {
      c.set("user", user);
    }
    if (authMethod) {
      c.set("authMethod", authMethod);
    }
    await next();
  });

  app.get("/entity/:id", middleware, (c) => {
    handlerRan = true;
    permissionResult = c.get("permissionResult");
    return c.json({ ok: true });
  });

  const res = await app.request(`/entity/${id}`);
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
    handlerRan,
    permissionResult,
  };
};

/** Runs `fn` with console.error silenced, returning what it logged. */
const captureConsoleError = async (fn: () => Promise<unknown>) => {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return calls;
};

const resolveTo = (projectId: string | null) => async () => projectId;

beforeEach(() => {
  permissionFixture = { allowed: true };
  permissionThrows = null;
  publicGovFixture = false;
  publicGovCalls = [];
  rbacServiceOptions = [];
  checkPermission.mock.resetCalls();
  isAdmin.mock.resetCalls();
});

describe("requireEntityPermission", () => {
  it("returns 401 when no user is on the context", async () => {
    const result = await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo("project-1"),
      ),
      { user: null },
    );

    assert.strictEqual(result.status, 401);
    assert.deepStrictEqual(result.body, { error: "Unauthorized" });
    assert.strictEqual(result.handlerRan, false);
    assert.strictEqual(checkPermission.mock.callCount(), 0);
  });

  it("answers an unresolvable id with the same 403 body as a denial", async () => {
    const missing = await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo(null),
      ),
    );

    permissionFixture = { allowed: false, reason: NO_PERMISSION_REASON };
    const denied = await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo("project-1"),
      ),
    );

    assert.strictEqual(missing.status, 403);
    assert.deepStrictEqual(missing.body, {
      error: "Forbidden",
      reason: NO_PERMISSION_REASON,
    });
    // Byte-identical: a missing row must not be distinguishable from one the
    // caller simply cannot see.
    assert.strictEqual(missing.status, denied.status);
    assert.deepStrictEqual(missing.body, denied.body);
    assert.strictEqual(missing.handlerRan, false);
  });

  it("does not run a permission check when the id is unresolvable", async () => {
    await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo(null),
      ),
    );

    assert.strictEqual(checkPermission.mock.callCount(), 0);
  });

  it("returns 403 with the resolver's reason when the check denies", async () => {
    permissionFixture = { allowed: false, reason: "Insufficient role" };

    const result = await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo("project-1"),
      ),
    );

    assert.strictEqual(result.status, 403);
    assert.deepStrictEqual(result.body, {
      error: "Forbidden",
      reason: "Insufficient role",
    });
    assert.strictEqual(result.handlerRan, false);
  });

  it("sets permissionResult and calls next when allowed", async () => {
    permissionFixture = {
      allowed: true,
      reason: "Direct permission",
      effectiveRole: "editor",
    };

    const result = await run(
      requireEntityPermission(
        EntityType.PROJECT,
        Action.UPDATE,
        resolveTo("project-1"),
      ),
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.handlerRan, true);
    assert.deepStrictEqual(result.permissionResult, permissionFixture);
    assert.strictEqual(checkPermission.mock.callCount(), 1);
  });

  it("returns 500 and logs when the permission check throws", async () => {
    permissionThrows = new Error("db down");
    let result: Awaited<ReturnType<typeof run>> | undefined;

    const logged = await captureConsoleError(async () => {
      result = await run(
        requireEntityPermission(
          EntityType.PROJECT,
          Action.UPDATE,
          resolveTo("project-1"),
        ),
      );
    });

    assert.strictEqual(result?.status, 500);
    assert.deepStrictEqual(result?.body, { error: "Internal Server Error" });
    assert.strictEqual(result?.handlerRan, false);
    assert.strictEqual(logged.length, 1);
    assert.strictEqual(logged[0][0], "RBAC middleware error:");
  });
});

describe("requireEntityReadOrPublicGov", () => {
  it("returns 401 when no user is on the context", async () => {
    const result = await run(
      requireEntityReadOrPublicGov(resolveTo("project-1")),
      { user: null },
    );

    assert.strictEqual(result.status, 401);
    assert.deepStrictEqual(result.body, { error: "Unauthorized" });
  });

  it("answers an unresolvable id with the uniform 403", async () => {
    const result = await run(requireEntityReadOrPublicGov(resolveTo(null)));

    assert.strictEqual(result.status, 403);
    assert.deepStrictEqual(result.body, {
      error: "Forbidden",
      reason: NO_PERMISSION_REASON,
    });
    assert.strictEqual(publicGovCalls.length, 0);
  });

  it("sets permissionResult and calls next for a member", async () => {
    permissionFixture = { allowed: true, effectiveRole: "viewer" };

    const result = await run(
      requireEntityReadOrPublicGov(resolveTo("project-1")),
    );

    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.permissionResult, permissionFixture);
    // The fallback is only consulted after a denial.
    assert.strictEqual(publicGovCalls.length, 0);
  });

  it("falls back to public-gov access without setting permissionResult", async () => {
    permissionFixture = { allowed: false, reason: NO_PERMISSION_REASON };
    publicGovFixture = true;

    const result = await run(
      requireEntityReadOrPublicGov(resolveTo("project-1"), {
        moduleName: "tasks",
      }),
    );

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.handlerRan, true);
    assert.strictEqual(result.permissionResult, undefined);
    assert.deepStrictEqual(publicGovCalls, [
      { projectId: "project-1", moduleName: "tasks" },
    ]);
  });

  it("returns 403 with the denial reason when the fallback also refuses", async () => {
    permissionFixture = { allowed: false, reason: "Insufficient role" };
    publicGovFixture = false;

    const result = await run(
      requireEntityReadOrPublicGov(resolveTo("project-1"), {
        moduleName: "tasks",
      }),
    );

    assert.strictEqual(result.status, 403);
    assert.deepStrictEqual(result.body, {
      error: "Forbidden",
      reason: "Insufficient role",
    });
    assert.strictEqual(result.handlerRan, false);
  });

  it("returns 500 and logs when the permission check throws", async () => {
    permissionThrows = new Error("db down");
    let result: Awaited<ReturnType<typeof run>> | undefined;

    const logged = await captureConsoleError(async () => {
      result = await run(requireEntityReadOrPublicGov(resolveTo("project-1")));
    });

    assert.strictEqual(result?.status, 500);
    assert.deepStrictEqual(result?.body, { error: "Internal Server Error" });
    assert.strictEqual(logged.length, 1);
    assert.strictEqual(logged[0][0], "RBAC middleware error:");
  });
});

describe("requirePermission (sync extractor)", () => {
  it("keeps its 400 for a missing entity id", async () => {
    const result = await run(
      requirePermission(EntityType.PROJECT, Action.UPDATE, () => null),
    );

    assert.strictEqual(result.status, 400);
    assert.deepStrictEqual(result.body, { error: "Entity ID not found" });
    assert.strictEqual(checkPermission.mock.callCount(), 0);
  });

  it("still sets permissionResult when allowed", async () => {
    permissionFixture = { allowed: true, effectiveRole: "owner" };

    const result = await run(
      requirePermission(EntityType.PROJECT, Action.UPDATE, (c) =>
        c.req.param("id"),
      ),
    );

    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.permissionResult, permissionFixture);
  });
});

describe("requireMemberPermission", () => {
  const guard = () =>
    requireMemberPermission(
      EntityType.OFFICE,
      Action.READ,
      (c) => c.req.param("id") ?? null,
    );

  it("allows a direct or inherited role on the entity", async () => {
    permissionFixture = {
      allowed: true,
      reason: "Inherited permission from parent entity",
      effectiveRole: "viewer",
    };

    const result = await run(guard());

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.handlerRan, true);
  });

  it("rejects READ derived only upward from a child membership", async () => {
    permissionFixture = {
      allowed: true,
      reason: UPWARD_READ_REASON,
      effectiveRole: "viewer",
    };

    const result = await run(guard());

    assert.strictEqual(result.status, 403);
    assert.deepStrictEqual(result.body, {
      error: "Forbidden",
      reason: NO_PERMISSION_REASON,
    });
    assert.strictEqual(result.handlerRan, false);
  });

  it("rejects when the check denies", async () => {
    permissionFixture = { allowed: false, reason: NO_PERMISSION_REASON };

    const result = await run(guard());

    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.handlerRan, false);
  });
});

describe("platform-admin bypass by auth method", () => {
  const guard = () =>
    requirePermission(
      EntityType.PROJECT,
      Action.UPDATE,
      (c) => c.req.param("id") ?? null,
    );

  it("never grants personal access tokens the platform-admin bypass", async () => {
    await run(guard(), { authMethod: "pat" });
    await run(requireEntityReadOrPublicGov(resolveTo("project-1")), {
      authMethod: "pat",
    });

    assert.deepStrictEqual(rbacServiceOptions, [
      { platformAdminBypass: false },
      { platformAdminBypass: false },
    ]);
  });

  it("keeps the bypass for session tokens", async () => {
    await run(guard(), { authMethod: "session" });
    await run(guard());

    assert.deepStrictEqual(rbacServiceOptions, [
      { platformAdminBypass: true },
      { platformAdminBypass: true },
    ]);
  });
});

describe("isSessionAdmin", () => {
  const probe: MiddlewareHandler<RBACContext> = async (c) =>
    c.json({ admin: await isSessionAdmin(c) });

  it("never treats a personal access token as a platform admin", async () => {
    const result = await run(probe, { authMethod: "pat" });

    assert.strictEqual(result.body.admin, false);
    assert.strictEqual(isAdmin.mock.callCount(), 0);
  });

  it("defers to the admin check for session tokens", async () => {
    const result = await run(probe, { authMethod: "session" });

    assert.strictEqual(result.body.admin, true);
    assert.deepStrictEqual(isAdmin.mock.calls[0]?.arguments, [
      USER.userId,
      USER.email,
    ]);
  });
});
