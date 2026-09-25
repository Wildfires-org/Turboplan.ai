import assert from "node:assert";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  milestoneInProject,
  milestoneProjectId,
  taskInProject,
  taskProjectId,
} from "../src/queries/task-references";

const PROJECT_ID = "00000000-0000-0000-0000-00000000000a";
const dialect = new PgDialect();

describe("milestoneInProject", () => {
  it("matches the project on either documentId or projectId", () => {
    const query = dialect.sqlToQuery(milestoneInProject(PROJECT_ID));
    assert.strictEqual(
      query.sql,
      '("milestones"."document_id" = $1 or "milestones"."project_id" = $2)',
    );
    assert.deepStrictEqual(query.params, [PROJECT_ID, PROJECT_ID]);
  });
});

describe("taskInProject", () => {
  it("matches on the task's documentId or on its milestone's project", () => {
    const query = dialect.sqlToQuery(taskInProject(PROJECT_ID));
    assert.strictEqual(
      query.sql,
      '("tasks"."document_id" = $1 or exists (select 1 from "milestones" where "milestones"."id" = "tasks"."milestone_id" and ("milestones"."document_id" = $2 or "milestones"."project_id" = $3)))',
    );
    assert.deepStrictEqual(query.params, [PROJECT_ID, PROJECT_ID, PROJECT_ID]);
  });
});

describe("milestoneProjectId", () => {
  it("prefers projectId and falls back to documentId", () => {
    const query = dialect.sqlToQuery(milestoneProjectId);
    assert.strictEqual(
      query.sql,
      'coalesce("milestones"."project_id", "milestones"."document_id")',
    );
    assert.deepStrictEqual(query.params, []);
  });
});

describe("taskProjectId", () => {
  it("inherits the milestone's project, falling back to the task's documentId", () => {
    const query = dialect.sqlToQuery(taskProjectId);
    assert.strictEqual(
      query.sql,
      'coalesce((select coalesce("milestones"."project_id", "milestones"."document_id") from "milestones" where "milestones"."id" = "tasks"."milestone_id"), "tasks"."document_id")',
    );
    assert.deepStrictEqual(query.params, []);
  });
});
