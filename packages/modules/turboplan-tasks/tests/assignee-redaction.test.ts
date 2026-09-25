import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withoutAssignees } from "../src/server/assignee-redaction";
import { resolveAssigneeProjectId } from "../src/utils/assignee-project";

const PERSON = { id: "u1", email: "person@example.test", emailVerified: null };

describe("withoutAssignees", () => {
  it("empties a task's assignees but keeps its assigneeIds", () => {
    const task = { id: "t1", assigneeIds: ["u1"], assignees: [PERSON] };

    const redacted = withoutAssignees(task);

    assert.deepEqual(redacted.assignees, []);
    assert.deepEqual(redacted.assigneeIds, ["u1"]);
  });

  it("empties assignees on a milestone and every nested task", () => {
    const milestone = {
      id: "m1",
      assignees: [PERSON],
      tasks: [
        { id: "t1", assignees: [PERSON] },
        { id: "t2", assignees: [PERSON] },
      ],
    };

    const redacted = withoutAssignees(milestone);

    assert.deepEqual(redacted.assignees, []);
    assert.deepEqual(
      redacted.tasks.map((task) => task.assignees),
      [[], []],
    );
    assert.equal(JSON.stringify(redacted).includes("@"), false);
  });

  it("does not mutate the input", () => {
    const task = { id: "t1", assignees: [PERSON] };

    withoutAssignees(task);

    assert.deepEqual(task.assignees, [PERSON]);
  });
});

describe("resolveAssigneeProjectId", () => {
  it("uses the id directly on a project page", () => {
    assert.equal(resolveAssigneeProjectId("project", "p1", []), "p1");
  });

  it("takes the project from the milestones of a chat artifact", () => {
    assert.equal(
      resolveAssigneeProjectId("document", "doc1", [
        { projectId: null },
        { projectId: "p1" },
      ]),
      "p1",
    );
  });

  it("returns null for an artifact with no project", () => {
    assert.equal(
      resolveAssigneeProjectId("document", "doc1", [{ projectId: null }]),
      null,
    );
    assert.equal(resolveAssigneeProjectId("document", "doc1", []), null);
  });
});
