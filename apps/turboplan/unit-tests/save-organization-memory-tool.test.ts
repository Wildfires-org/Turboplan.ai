import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type { SaveOrganizationMemoryResult } from "@wildfires-org/turboplan-workspace/server";

import type * as SaveOrganizationMemoryModule from "../lib/ai/tools/save-organization-memory";
import type { SaveOrganizationMemoryToolOutput } from "../types/organization-context";

const ORGANIZATION_ID = "org-1";
const ORGANIZATION_NAME = "Acme Forestry";
const USER_ID = "user-1";

const MEMORY = {
  id: "memory-1",
  content: "Comment letters are signed by the District Ranger.",
  createdAt: new Date("2026-10-06T00:00:00Z"),
  createdBy: USER_ID,
};

let isUpdateAllowed = true;
let saveResult: SaveOrganizationMemoryResult = {
  status: "created",
  memory: MEMORY,
};
const permissionCalls: unknown[][] = [];
const saveCalls: Array<{
  organizationId: string;
  userId: string;
  content: string;
}> = [];

mock.module("@wildfires-org/turboplan-ai", {
  namedExports: { getPrompt: async () => "Save organization memory." },
});
mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: {
    saveOrganizationMemory: async (input: {
      organizationId: string;
      userId: string;
      content: string;
    }) => {
      saveCalls.push(input);
      return saveResult;
    },
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async (...args: unknown[]) => {
        permissionCalls.push(args);
        return { allowed: isUpdateAllowed };
      },
    }),
  },
});

// The turboplan app resolves as CJS, so import after the mocks are registered.
let toolModule: typeof SaveOrganizationMemoryModule;

before(async () => {
  toolModule = await import("../lib/ai/tools/save-organization-memory");
});

const run = async (content: string) => {
  const saveTool = await toolModule.saveOrganizationMemory({
    organizationId: ORGANIZATION_ID,
    organizationName: ORGANIZATION_NAME,
    userId: USER_ID,
  });
  return (await saveTool.execute?.(
    { content },
    { toolCallId: "call-1", messages: [] },
  )) as SaveOrganizationMemoryToolOutput;
};

describe("saveOrganizationMemory tool", () => {
  beforeEach(() => {
    isUpdateAllowed = true;
    saveResult = { status: "created", memory: MEMORY };
    permissionCalls.length = 0;
    saveCalls.length = 0;
  });

  it("re-checks organization UPDATE and saves nothing when denied", async () => {
    isUpdateAllowed = false;

    const result = await run(MEMORY.content);

    assert.deepStrictEqual(result, { error: "Access denied." });
    assert.deepStrictEqual(permissionCalls, [
      [USER_ID, ORGANIZATION_ID, "organization", "update"],
    ]);
    assert.strictEqual(saveCalls.length, 0);
  });

  it("saves to the bound organization and reports it as saved", async () => {
    const result = await run(MEMORY.content);

    assert.deepStrictEqual(saveCalls, [
      {
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        content: MEMORY.content,
      },
    ]);
    assert.deepStrictEqual(result, {
      status: "saved",
      memory: { id: MEMORY.id, content: MEMORY.content },
      organizationName: ORGANIZATION_NAME,
    });
  });

  it("reports a note the organization already has as already saved", async () => {
    saveResult = { status: "duplicate", memory: MEMORY };

    const result = await run(MEMORY.content.toUpperCase());

    assert.deepStrictEqual(result, {
      status: "already_saved",
      memory: { id: MEMORY.id, content: MEMORY.content },
      organizationName: ORGANIZATION_NAME,
    });
  });

  it("tells the model the memory is full and where notes can be deleted", async () => {
    saveResult = { status: "full" };

    const result = await run(MEMORY.content);

    assert.ok("error" in result);
    assert.match(result.error, /full \(50 notes\)/);
    assert.match(result.error, /Context page/);
  });

  it("asks for a shorter note when it is too long", async () => {
    saveResult = { status: "too_long" };

    const result = await run(MEMORY.content);

    assert.ok("error" in result);
    assert.match(result.error, /longer than 300 characters/);
    assert.match(result.error, /Shorten it/);
  });

  it("asks for an actual statement when the note is empty", async () => {
    saveResult = { status: "empty" };

    const result = await run("   ");

    assert.ok("error" in result);
    assert.match(result.error, /the note is empty/);
  });
});
