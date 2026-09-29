import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TASK_ASSIGNMENT_ERROR,
  validateTaskAssignment,
} from "../src/server/invitations/task-assignment";

const PROJECT_ID = "00000000-0000-0000-0000-00000000000a";
const OWN_TASK = "00000000-0000-0000-0000-0000000000a1";
const OWN_MILESTONE = "00000000-0000-0000-0000-0000000000b1";
const FOREIGN_ID = "00000000-0000-0000-0000-0000000000ff";

/** Lookups backed by fixed per-project rows; records every call. */
const makeLookups = () => {
  const calls: string[] = [];
  const resolveIn =
    (kind: string, owned: string) =>
    async (projectId: string, ids: string[]) => {
      calls.push(kind);
      return projectId === PROJECT_ID ? ids.filter((id) => id === owned) : [];
    };
  return {
    calls,
    lookups: {
      getTaskIdsInProject: resolveIn("task", OWN_TASK),
      getMilestoneIdsInProject: resolveIn("milestone", OWN_MILESTONE),
    },
  };
};

describe("validateTaskAssignment", () => {
  it("accepts a missing or empty assignment without querying", async () => {
    const { calls, lookups } = makeLookups();
    assert.equal(
      await validateTaskAssignment(PROJECT_ID, undefined, lookups),
      null,
    );
    assert.equal(await validateTaskAssignment(PROJECT_ID, {}, lookups), null);
    assert.deepEqual(calls, []);
  });

  it("accepts a task and milestone that both belong to the project", async () => {
    const { lookups } = makeLookups();
    const result = await validateTaskAssignment(
      PROJECT_ID,
      { taskId: OWN_TASK, milestoneId: OWN_MILESTONE },
      lookups,
    );
    assert.equal(result, null);
  });

  it("rejects a task id that does not resolve inside the project", async () => {
    const { lookups } = makeLookups();
    const result = await validateTaskAssignment(
      PROJECT_ID,
      { taskId: FOREIGN_ID },
      lookups,
    );
    assert.equal(result, TASK_ASSIGNMENT_ERROR);
  });

  it("rejects a milestone id that does not resolve inside the project", async () => {
    const { lookups } = makeLookups();
    const result = await validateTaskAssignment(
      PROJECT_ID,
      { taskId: OWN_TASK, milestoneId: FOREIGN_ID },
      lookups,
    );
    assert.equal(result, TASK_ASSIGNMENT_ERROR);
  });

  it("rejects the project's own ids when checked against another project", async () => {
    const { lookups } = makeLookups();
    const result = await validateTaskAssignment(
      "00000000-0000-0000-0000-00000000000b",
      { milestoneId: OWN_MILESTONE },
      lookups,
    );
    assert.equal(result, TASK_ASSIGNMENT_ERROR);
  });
});
