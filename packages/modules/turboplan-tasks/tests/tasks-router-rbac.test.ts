/**
 * Authorization wiring for the tasks router.
 *
 * These tests pin the route → (entity type, action, entity id) contract of the
 * guards, not the handlers: the RBAC middleware is replaced with a stub that
 * records what each route asked for and answers from the real role→action
 * table, and the service layer is stubbed so no database is touched.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import type { Context, Next } from "hono";
import { Hono } from "hono";

import {
  Action,
  type ActionType,
  EntityType,
  type EntityTypeType,
  MemberRole,
  type MemberRoleType,
  roleHasPermission,
} from "@wildfires-org/turboplan-rbac";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const UNKNOWN_TASK_ID = "55555555-5555-4555-8555-555555555555";

/** A real user the caller is not, used to attempt authorship forgery. */
const OTHER_USER_ID = "66666666-6666-4666-8666-666666666666";

/** A project the caller holds no role on. */
const OTHER_PROJECT_ID = "77777777-7777-4777-8777-777777777777";

const OWN_DOCUMENT_ID = "88888888-8888-4888-8888-888888888888";
const FOREIGN_DOCUMENT_ID = "99999999-9999-4999-8999-999999999999";
const OWN_DEPENDENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOREIGN_DEPENDENCY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNKNOWN_USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * A legacy task: its `documentId` is the chat `Document` it was generated from,
 * and only its milestone records PROJECT_ID.
 */
const LEGACY_TASK_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CHAT_DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/** Role the stubbed RBAC layer grants the caller on PROJECT_ID. */
let callerRole: MemberRoleType | null = MemberRole.EDITOR;

/** What each guard asked for, in the order the routes ran. */
type GuardCall = {
  entityType: EntityTypeType;
  action: ActionType;
  entityId: string | null;
};
let guardCalls: GuardCall[] = [];

type EntityIdResolver = (c: Context) => string | null | Promise<string | null>;

const denied = (c: Context) =>
  c.json({ error: "Forbidden", reason: "No permission found" }, 403);

/**
 * Stand-in for every guard in `@wildfires-org/turboplan-rbac/hono`: records the
 * permission the route demanded, then answers it from the real role→action
 * table for `callerRole`.
 */
const stubGuard =
  (
    entityType: EntityTypeType,
    action: ActionType,
    resolveEntityId: EntityIdResolver,
  ) =>
  async (c: Context, next: Next) => {
    const user = c.get("user") as { userId?: string } | undefined;
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const entityId = await resolveEntityId(c);
    guardCalls.push({ entityType, action, entityId });

    if (!entityId) {
      return denied(c);
    }

    if (!callerRole || !roleHasPermission(callerRole, action)) {
      return denied(c);
    }

    c.set("permissionResult", { allowed: true, effectiveRole: callerRole });
    await next();
  };

mock.module("@wildfires-org/turboplan-rbac/hono", {
  namedExports: {
    // The stub guards only ever grant through a role.
    isMembershipGrant: (result: { allowed: boolean }) => result.allowed,
    requirePermission: stubGuard,
    requireEntityPermission: stubGuard,
    requireProjectReadOrPublicGov: (resolveProjectId: EntityIdResolver) =>
      stubGuard(EntityType.PROJECT, Action.READ, resolveProjectId),
    requireEntityReadOrPublicGov: (resolveProjectId: EntityIdResolver) =>
      stubGuard(EntityType.PROJECT, Action.READ, resolveProjectId),
  },
});

/**
 * Rows the reference lookups resolve against. Two projects, so a request can
 * name a row the caller has no access to and the router has to notice.
 */
const projectDocuments = [
  { id: OWN_DOCUMENT_ID, projectId: PROJECT_ID },
  { id: FOREIGN_DOCUMENT_ID, projectId: OTHER_PROJECT_ID },
].map((doc) => ({
  ...doc,
  url: `https://storage.test/${doc.id}`,
  originalFilename: `${doc.id}.pdf`,
  mimeType: "application/pdf",
}));

const taskRows = [
  { id: OWN_DEPENDENCY_ID, documentId: PROJECT_ID },
  { id: FOREIGN_DEPENDENCY_ID, documentId: OTHER_PROJECT_ID },
];

const existingUserIds = new Set([USER_ID, OTHER_USER_ID]);

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    // Rows are resolved from a fixture instead of the database: TASK_ID and
    // LEGACY_TASK_ID (via its milestone) belong to PROJECT_ID, everything else
    // is unknown.
    getTaskProjectId: async (id: string) =>
      id === TASK_ID || id === LEGACY_TASK_ID ? PROJECT_ID : null,
    getMilestoneProjectId: async (id: string) =>
      id === MILESTONE_ID ? PROJECT_ID : null,
    // Only referenced by the (unused, stubbed) repository's list queries.
    milestoneInProject: () => undefined,
    taskInProject: () => undefined,
    getProjectDocumentsByIds: async (ids: string[], projectId?: string) =>
      projectDocuments.filter(
        (doc) =>
          ids.includes(doc.id) &&
          (projectId === undefined || doc.projectId === projectId),
      ),
    getTaskIdsInProject: async (projectId: string, ids: string[]) =>
      taskRows
        .filter((row) => ids.includes(row.id) && row.documentId === projectId)
        .map((row) => row.id),
    getExistingUserIds: async (ids: string[]) =>
      ids.filter((id) => existingUserIds.has(id)),
  },
});

const timelineRecords: unknown[] = [];

mock.module("@wildfires-org/turboplan-timeline-records/server", {
  namedExports: {
    createTimelineRecord: async (record: unknown) => {
      timelineRecords.push(record);
    },
    computeChanges: () => [],
    taskFieldDefs: {},
  },
});

mock.module("../src/server/notification-service", {
  namedExports: {
    getTaskNotificationService: () => ({}),
  },
});

type TaskInput = {
  id?: string;
  title: string;
  milestoneId: string;
  userId?: string;
};

/** Everything the router asked the service to write, in call order. */
const serviceWrites: TaskInput[] = [];

mock.module("../src/server/service", {
  namedExports: {
    TaskService: class {
      async createTask(input: TaskInput) {
        serviceWrites.push(input);
        return { id: TASK_ID, title: input.title, milestoneId: MILESTONE_ID };
      }
      async createTaskForRestore(input: TaskInput) {
        serviceWrites.push(input);
        return {
          id: input.id ?? TASK_ID,
          title: input.title,
          milestoneId: MILESTONE_ID,
        };
      }
      async getTaskById(id: string) {
        return {
          id,
          title: "Task",
          milestoneId: MILESTONE_ID,
          documentId: id === LEGACY_TASK_ID ? CHAT_DOCUMENT_ID : PROJECT_ID,
          assigneeIds: [],
        };
      }
      async updateTask(id: string) {
        return { id, title: "Task", milestoneId: MILESTONE_ID };
      }
      async deleteTask() {
        return true;
      }
    },
    MilestoneService: class {
      setTaskRepository() {}
      async getMilestoneById(id: string) {
        return { id, projectId: PROJECT_ID };
      }
    },
  },
});

const { default: tasksRouter } = await import("../src/server/tasks-router");

/** Drive one request through the router with `callerRole` in effect. */
const request = async (
  method: string,
  path: string,
  {
    body,
    authenticated = true,
  }: { body?: unknown; authenticated?: boolean } = {},
) => {
  const app = new Hono();
  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", { userId: USER_ID, email: "user@example.test" });
    }
    await next();
  });
  app.route("/tasks", tasksRouter);

  const res = await app.request(`/tasks${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
  });

  return { status: res.status, body: await res.json().catch(() => null) };
};

const taskPayload = {
  title: "Write the RFC",
  milestoneId: MILESTONE_ID,
};

beforeEach(() => {
  callerRole = MemberRole.EDITOR;
  guardCalls = [];
  timelineRecords.length = 0;
  serviceWrites.length = 0;
});

describe("tasks router — create", () => {
  it("demands UPDATE on the project named by :documentId", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: taskPayload,
    });

    assert.equal(res.status, 201);
    assert.deepEqual(guardCalls, [
      {
        entityType: EntityType.PROJECT,
        action: Action.UPDATE,
        entityId: PROJECT_ID,
      },
    ]);
  });

  it("returns 403 for a viewer", async () => {
    callerRole = MemberRole.VIEWER;

    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: taskPayload,
    });

    assert.equal(res.status, 403);
    assert.equal(timelineRecords.length, 0);
  });

  it("returns 403 for a non-member", async () => {
    callerRole = null;

    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: taskPayload,
    });

    assert.equal(res.status, 403);
  });

  it("returns 401 without an authenticated user", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: taskPayload,
      authenticated: false,
    });

    assert.equal(res.status, 401);
  });
});

describe("tasks router — restore", () => {
  it("demands UPDATE on the project named by :documentId", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}/restore`, {
      body: { ...taskPayload, id: TASK_ID },
    });

    assert.equal(res.status, 201);
    assert.deepEqual(guardCalls, [
      {
        entityType: EntityType.PROJECT,
        action: Action.UPDATE,
        entityId: PROJECT_ID,
      },
    ]);
  });

  it("returns 403 for a viewer", async () => {
    callerRole = MemberRole.VIEWER;

    const res = await request("POST", `/document/${PROJECT_ID}/restore`, {
      body: { ...taskPayload, id: TASK_ID },
    });

    assert.equal(res.status, 403);
  });
});

/**
 * The guard proves the caller may write PROJECT_ID. It says nothing about the
 * ids inside the body, none of which are foreign keys — so a request that names
 * another project's rows has to be refused by the handler itself.
 */
describe("tasks router — cross-project references", () => {
  it("rejects a projectDocumentId owned by another project", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, projectDocumentIds: [FOREIGN_DOCUMENT_ID] },
    });

    assert.equal(res.status, 400);
    assert.equal(serviceWrites.length, 0);
    assert.equal(timelineRecords.length, 0);
  });

  it("accepts a projectDocumentId owned by this project", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, projectDocumentIds: [OWN_DOCUMENT_ID] },
    });

    assert.equal(res.status, 201);
  });

  it("reports a foreign document the same way as one that does not exist", async () => {
    const foreign = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, projectDocumentIds: [FOREIGN_DOCUMENT_ID] },
    });
    const absent = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, projectDocumentIds: [UNKNOWN_TASK_ID] },
    });

    assert.equal(foreign.status, absent.status);
    assert.deepEqual(foreign.body, absent.body);
  });

  it("rejects a dependency on a task in another project", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, dependencies: [FOREIGN_DEPENDENCY_ID] },
    });

    assert.equal(res.status, 400);
    assert.equal(serviceWrites.length, 0);
  });

  it("rejects an assignee who is not a user", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}`, {
      body: { ...taskPayload, assigneeIds: [UNKNOWN_USER_ID] },
    });

    assert.equal(res.status, 400);
    assert.equal(serviceWrites.length, 0);
  });

  it("rejects a foreign projectDocumentId on update, scoped to the task's own project", async () => {
    const res = await request("PUT", `/${TASK_ID}`, {
      body: { projectDocumentIds: [FOREIGN_DOCUMENT_ID] },
    });

    assert.equal(res.status, 400);
    assert.equal(timelineRecords.length, 0);
  });

  it("rejects a foreign projectDocumentId on restore", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}/restore`, {
      body: {
        ...taskPayload,
        id: TASK_ID,
        projectDocumentIds: [FOREIGN_DOCUMENT_ID],
      },
    });

    assert.equal(res.status, 400);
    assert.equal(serviceWrites.length, 0);
  });
});

/**
 * Restore writes a caller-supplied row id and used to accept a caller-supplied
 * author, which let an Editor file a task under somebody else's name.
 */
describe("tasks router — restore cannot forge the audit trail", () => {
  it("records the authenticated caller, not a userId from the body", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}/restore`, {
      body: { ...taskPayload, id: TASK_ID, userId: OTHER_USER_ID },
    });

    assert.equal(res.status, 201);
    assert.equal(serviceWrites.length, 1);
    assert.equal(serviceWrites[0].userId, USER_ID);
  });

  it("rejects an id that is not a uuid before it reaches the database", async () => {
    const res = await request("POST", `/document/${PROJECT_ID}/restore`, {
      body: { ...taskPayload, id: "not-a-uuid" },
    });

    assert.equal(res.status, 400);
    assert.equal(serviceWrites.length, 0);
  });
});

describe("tasks router — delete", () => {
  it("demands DELETE on the project owning the task", async () => {
    callerRole = MemberRole.OWNER;

    const res = await request("DELETE", `/${TASK_ID}`);

    assert.equal(res.status, 200);
    assert.deepEqual(guardCalls, [
      {
        entityType: EntityType.PROJECT,
        action: Action.DELETE,
        entityId: PROJECT_ID,
      },
    ]);
  });

  it("returns 403 for an editor, who does not hold DELETE", async () => {
    callerRole = MemberRole.EDITOR;

    const res = await request("DELETE", `/${TASK_ID}`);

    assert.equal(res.status, 403);
    assert.equal(timelineRecords.length, 0);
  });

  it("returns 403 rather than 404 for a task id that resolves to nothing", async () => {
    callerRole = MemberRole.OWNER;

    const res = await request("DELETE", `/${UNKNOWN_TASK_ID}`);

    assert.equal(res.status, 403);
    assert.deepEqual(guardCalls, [
      {
        entityType: EntityType.PROJECT,
        action: Action.DELETE,
        entityId: null,
      },
    ]);
  });
});

/**
 * Legacy tasks hold a chat `Document` id in `documentId`; the project comes from
 * their milestone. Guarding on `documentId` denied even the project owner.
 */
describe("tasks router — legacy rows", () => {
  it("guards a legacy task on its milestone's project", async () => {
    const res = await request("PUT", `/${LEGACY_TASK_ID}`, {
      body: { title: "Renamed" },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(guardCalls, [
      {
        entityType: EntityType.PROJECT,
        action: Action.UPDATE,
        entityId: PROJECT_ID,
      },
    ]);
  });

  it("allows reading a legacy task", async () => {
    callerRole = MemberRole.VIEWER;

    const res = await request("GET", `/${LEGACY_TASK_ID}`);

    assert.equal(res.status, 200);
    assert.equal(guardCalls[0].entityId, PROJECT_ID);
  });

  it("validates a legacy task's references against its project, not the chat document", async () => {
    const own = await request("PUT", `/${LEGACY_TASK_ID}`, {
      body: { projectDocumentIds: [OWN_DOCUMENT_ID] },
    });
    const foreign = await request("PUT", `/${LEGACY_TASK_ID}`, {
      body: { projectDocumentIds: [FOREIGN_DOCUMENT_ID] },
    });

    assert.equal(own.status, 200);
    assert.equal(foreign.status, 400);
  });
});
