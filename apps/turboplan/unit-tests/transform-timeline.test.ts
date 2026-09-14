import assert from "node:assert";
import { describe, it } from "node:test";

import { transformTimelineRecord } from "@wildfires-org/turboplan-timeline-records/client";
import type { EnrichedTimelineRecord } from "@wildfires-org/turboplan-timeline-records/types";

const makeRecord = (
  overrides: Partial<EnrichedTimelineRecord> = {},
): EnrichedTimelineRecord => ({
  id: "rec-001",
  projectId: "proj-001",
  userId: "user-001",
  entityType: "task",
  entityId: "entity-001",
  entityName: null,
  action: "created",
  title: null,
  description: null,
  changes: null,
  resourceUrls: null,
  isPublic: true,
  metadata: null,
  startedAt: null,
  endedAt: null,
  createdAt: new Date("2025-06-15T12:00:00Z"),
  deletedAt: null,
  authorEmail: "alice@example.com",
  authorFirstName: "Alice",
  authorLastName: "Smith",
  authorAvatarUrl: null,
  ...overrides,
});

describe("transformTimelineRecord", () => {
  describe("basic transformation", () => {
    it("should transform a fully populated record", () => {
      const record = makeRecord({
        id: "rec-123",
        entityId: "ent-456",
        title: "Custom Title",
        description: "Custom Description",
        isPublic: false,
        authorAvatarUrl: "https://example.com/avatar.png",
        resourceUrls: [
          { filename: "report.pdf", url: "https://example.com/report.pdf" },
        ],
        startedAt: new Date("2025-01-01T00:00:00Z"),
        endedAt: new Date("2025-06-01T00:00:00Z"),
      });

      const result = transformTimelineRecord(record);

      assert.strictEqual(result.id, "rec-123");
      assert.strictEqual(result.entityId, "ent-456");
      assert.strictEqual(result.title, "Custom Title");
      assert.strictEqual(result.description, "Custom Description");
      assert.strictEqual(result.isPublic, false);
      assert.strictEqual(
        result.authorAvatarUrl,
        "https://example.com/avatar.png",
      );
      assert.deepStrictEqual(result.documents, [
        { filename: "report.pdf", url: "https://example.com/report.pdf" },
      ]);
    });

    it("should pass through id, entityId, isPublic, and authorAvatarUrl directly", () => {
      const record = makeRecord({
        id: "abc",
        entityId: "def",
        isPublic: false,
        authorAvatarUrl: "https://avatar.test/img.jpg",
      });

      const result = transformTimelineRecord(record);

      assert.strictEqual(result.id, "abc");
      assert.strictEqual(result.entityId, "def");
      assert.strictEqual(result.isPublic, false);
      assert.strictEqual(result.authorAvatarUrl, "https://avatar.test/img.jpg");
    });

    it("should use record.title when provided", () => {
      const result = transformTimelineRecord(
        makeRecord({ title: "My Custom Title" }),
      );
      assert.strictEqual(result.title, "My Custom Title");
    });

    it("should generate title when record.title is null", () => {
      const result = transformTimelineRecord(
        makeRecord({ title: null, action: "created", entityType: "task" }),
      );
      assert.strictEqual(result.title, "Created Task");
    });

    it("should use record.description when provided", () => {
      const result = transformTimelineRecord(
        makeRecord({ description: "A detailed description" }),
      );
      assert.strictEqual(result.description, "A detailed description");
    });

    it("should generate description when record.description is null", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "status",
              previousValue: "draft",
              newValue: "in_progress",
              valueType: "enum",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Status changed from Draft to In Progress",
      );
    });

    it("should map resourceUrls to documents", () => {
      const result = transformTimelineRecord(
        makeRecord({
          resourceUrls: [
            {
              filename: "a.pdf",
              url: "https://example.com/a.pdf",
              type: "application/pdf",
            },
            { filename: "b.png", url: "https://example.com/b.png" },
          ],
        }),
      );

      assert.deepStrictEqual(result.documents, [
        { filename: "a.pdf", url: "https://example.com/a.pdf" },
        { filename: "b.png", url: "https://example.com/b.png" },
      ]);
    });

    it("should handle null resourceUrls as empty documents array", () => {
      const result = transformTimelineRecord(
        makeRecord({ resourceUrls: null }),
      );
      assert.deepStrictEqual(result.documents, []);
    });
  });

  describe("title generation", () => {
    it("should generate title for each action type", () => {
      const cases: { action: string; expected: string }[] = [
        { action: "created", expected: "Created Task" },
        { action: "updated", expected: "Updated Task" },
        { action: "deleted", expected: "Deleted Task" },
        { action: "added", expected: "Added Task" },
        { action: "removed", expected: "Removed Task" },
        { action: "role_changed", expected: "Role changed for Task" },
      ];

      for (const { action, expected } of cases) {
        const result = transformTimelineRecord(
          makeRecord({ title: null, action, entityType: "task" }),
        );
        assert.strictEqual(result.title, expected, `action="${action}"`);
      }
    });

    it("should generate title for each entity type", () => {
      const cases: { entityType: string; expected: string }[] = [
        { entityType: "project", expected: "Created Project" },
        { entityType: "task", expected: "Created Task" },
        { entityType: "milestone", expected: "Created Milestone" },
        { entityType: "map_layer", expected: "Created Map Layer" },
        { entityType: "field", expected: "Created Field" },
        { entityType: "comment", expected: "Created Comment" },
        { entityType: "document", expected: "Created Document" },
        { entityType: "member", expected: "Created Member" },
        { entityType: "dependency", expected: "Created Dependency" },
      ];

      for (const { entityType, expected } of cases) {
        const result = transformTimelineRecord(
          makeRecord({ title: null, action: "created", entityType }),
        );
        assert.strictEqual(
          result.title,
          expected,
          `entityType="${entityType}"`,
        );
      }
    });

    it("should include quoted entityName when present", () => {
      const result = transformTimelineRecord(
        makeRecord({
          title: null,
          action: "updated",
          entityType: "project",
          entityName: "My Project",
        }),
      );
      assert.strictEqual(result.title, 'Updated Project "My Project"');
    });

    it("should omit entityName when null", () => {
      const result = transformTimelineRecord(
        makeRecord({
          title: null,
          action: "deleted",
          entityType: "milestone",
          entityName: null,
        }),
      );
      assert.strictEqual(result.title, "Deleted Milestone");
    });

    it("should fall back to raw action value for unknown actions", () => {
      const result = transformTimelineRecord(
        makeRecord({
          title: null,
          action: "archived",
          entityType: "task",
        }),
      );
      assert.strictEqual(result.title, "archived Task");
    });

    it("should fall back to raw entityType value for unknown entity types", () => {
      const result = transformTimelineRecord(
        makeRecord({
          title: null,
          action: "created",
          entityType: "widget",
        }),
      );
      assert.strictEqual(result.title, "Created widget");
    });
  });

  describe("description generation", () => {
    it("should return empty string for empty changes array", () => {
      const result = transformTimelineRecord(
        makeRecord({ description: null, changes: [] }),
      );
      assert.strictEqual(result.description, "");
    });

    it("should return empty string for null changes", () => {
      const result = transformTimelineRecord(
        makeRecord({ description: null, changes: null }),
      );
      assert.strictEqual(result.description, "");
    });

    it("should format enum change: draft to not_started", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "status",
              previousValue: "draft",
              newValue: "not_started",
              valueType: "enum",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Status changed from Draft to Not Started",
      );
    });

    it("should format enum change: not_started to in_progress", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "status",
              previousValue: "not_started",
              newValue: "in_progress",
              valueType: "enum",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Status changed from Not Started to In Progress",
      );
    });

    it("should format role change", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "role",
              previousValue: "viewer",
              newValue: "editor",
              valueType: "role",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Role changed from Viewer to Editor",
      );
    });

    it("should quote text values", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "title",
              previousValue: "Old Title",
              newValue: "New Title",
              valueType: "text",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        'Title changed from "Old Title" to "New Title"',
      );
    });

    it("should format boolean change", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "isPublic",
              previousValue: false,
              newValue: true,
              valueType: "boolean",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Visibility changed from disabled to enabled",
      );
    });

    it("should format date change with formatted dates", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "startDate",
              previousValue: "2025-01-15",
              newValue: "2025-03-20",
              valueType: "date",
            },
          ],
        }),
      );

      // The exact format depends on locale, but it should contain the formatted dates
      assert.ok(
        result.description.startsWith("Start date changed from "),
        `Expected description to start with 'Start date changed from ', got: "${result.description}"`,
      );
      assert.ok(
        result.description.includes("2025"),
        `Expected description to contain year 2025, got: "${result.description}"`,
      );
    });

    it("should format json change as 'updated'", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "dependencies",
              previousValue: { a: 1 },
              newValue: { a: 2 },
              valueType: "json",
            },
          ],
        }),
      );
      assert.strictEqual(result.description, "Dependencies updated");
    });

    it("should format users change with correct pluralization", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "assigneeIds",
              previousValue: ["a"],
              newValue: ["a", "b", "c"],
              valueType: "users",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Assignees changed from 1 user to 3 users",
      );
    });

    it("should format singular user count (1 user, not 1 users)", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "assigneeIds",
              previousValue: ["a", "b"],
              newValue: ["c"],
              valueType: "users",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        "Assignees changed from 2 users to 1 user",
      );
    });

    it("should format initial value set (oldValue null) for enum", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "status",
              previousValue: null,
              newValue: "draft",
              valueType: "enum",
            },
          ],
        }),
      );
      assert.strictEqual(result.description, "Status set to Draft");
    });

    it("should quote initial text value set (oldValue null)", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "name",
              previousValue: null,
              newValue: "My Project",
              valueType: "text",
            },
          ],
        }),
      );
      assert.strictEqual(result.description, 'Name set to "My Project"');
    });

    it("should join multiple changes with newline", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "status",
              previousValue: "draft",
              newValue: "in_progress",
              valueType: "enum",
            },
            {
              field: "title",
              previousValue: "Old",
              newValue: "New",
              valueType: "text",
            },
          ],
        }),
      );
      const lines = result.description.split("\n");
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], "Status changed from Draft to In Progress");
      assert.strictEqual(lines[1], 'Title changed from "Old" to "New"');
    });

    it("should fall back to raw field key for unknown fields", () => {
      const result = transformTimelineRecord(
        makeRecord({
          description: null,
          changes: [
            {
              field: "customField",
              previousValue: "a",
              newValue: "b",
              valueType: "text",
            },
          ],
        }),
      );
      assert.strictEqual(
        result.description,
        'customField changed from "a" to "b"',
      );
    });
  });

  describe("author name", () => {
    it("should return full name when both first and last name are present", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: "Alice",
          authorLastName: "Smith",
        }),
      );
      assert.strictEqual(result.authorName, "Alice Smith");
    });

    it("should return first name only when last name is null", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: "Alice",
          authorLastName: null,
        }),
      );
      assert.strictEqual(result.authorName, "Alice");
    });

    it("should return last name only when first name is null", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: null,
          authorLastName: "Smith",
        }),
      );
      assert.strictEqual(result.authorName, "Smith");
    });

    it("should fall back to email when both names are null", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: null,
          authorLastName: null,
          authorEmail: "bob@example.com",
        }),
      );
      assert.strictEqual(result.authorName, "bob@example.com");
    });
  });

  describe("author initials", () => {
    it("should return uppercase initials when both names are present", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: "alice",
          authorLastName: "smith",
        }),
      );
      assert.strictEqual(result.authorInitials, "AS");
    });

    it("should return single initial when only first name is present", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: "bob",
          authorLastName: null,
        }),
      );
      assert.strictEqual(result.authorInitials, "B");
    });

    it("should return null when no name is available", () => {
      const result = transformTimelineRecord(
        makeRecord({
          authorFirstName: null,
          authorLastName: null,
        }),
      );
      assert.strictEqual(result.authorInitials, null);
    });
  });

  describe("date range", () => {
    it("should format month range when both startedAt and endedAt are provided", () => {
      const result = transformTimelineRecord(
        makeRecord({
          startedAt: new Date("2025-01-15T00:00:00Z"),
          endedAt: new Date("2025-06-20T00:00:00Z"),
        }),
      );
      // "January 2025 - June 2025" with en-dash
      assert.ok(
        result.dateRange.includes("January"),
        `Expected "January" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("June"),
        `Expected "June" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("\u2013"),
        `Expected en-dash in dateRange, got: "${result.dateRange}"`,
      );
    });

    it("should format full date when only startedAt is provided", () => {
      const result = transformTimelineRecord(
        makeRecord({
          startedAt: new Date("2025-03-10T00:00:00Z"),
          endedAt: null,
        }),
      );
      // Should be a full date like "March 10, 2025"
      assert.ok(
        result.dateRange.includes("March"),
        `Expected "March" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("2025"),
        `Expected "2025" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("10"),
        `Expected "10" in dateRange, got: "${result.dateRange}"`,
      );
    });

    it("should use createdAt when neither startedAt nor endedAt is provided", () => {
      const result = transformTimelineRecord(
        makeRecord({
          startedAt: null,
          endedAt: null,
          createdAt: new Date("2025-06-15T12:00:00Z"),
        }),
      );
      assert.ok(
        result.dateRange.includes("June"),
        `Expected "June" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("2025"),
        `Expected "2025" in dateRange, got: "${result.dateRange}"`,
      );
      assert.ok(
        result.dateRange.includes("15"),
        `Expected "15" in dateRange, got: "${result.dateRange}"`,
      );
    });
  });
});
