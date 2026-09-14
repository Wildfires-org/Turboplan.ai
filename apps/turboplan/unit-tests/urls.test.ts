import assert from "node:assert";
import { describe, it } from "node:test";

import { AppUrls } from "../lib/nav/urls";

describe("AppUrls", () => {
  describe("static routes", () => {
    it("should have correct home route", () => {
      assert.strictEqual(AppUrls.home, "/");
    });

    it("should have correct login route", () => {
      assert.strictEqual(AppUrls.login, "/login");
    });

    it("should have correct register route", () => {
      assert.strictEqual(AppUrls.register, "/register");
    });

    it("should have correct profile route", () => {
      assert.strictEqual(AppUrls.profile, "/profile");
    });

    it("should have correct settings route", () => {
      assert.strictEqual(AppUrls.settings, "/settings");
    });

    it("should have correct admin route", () => {
      assert.strictEqual(AppUrls.admin, "/admin");
    });
  });

  describe("organization routes", () => {
    it("should generate correct organization URL", () => {
      assert.strictEqual(
        AppUrls.organization("my-org"),
        "/organizations/my-org",
      );
    });

    it("should handle slugs with numbers", () => {
      assert.strictEqual(
        AppUrls.organization("org-123"),
        "/organizations/org-123",
      );
    });

    it("should handle unique slug format", () => {
      assert.strictEqual(
        AppUrls.organization("my-organization-abc123"),
        "/organizations/my-organization-abc123",
      );
    });
  });

  describe("office routes", () => {
    it("should generate correct office URL", () => {
      assert.strictEqual(
        AppUrls.office("my-org", "my-office"),
        "/organizations/my-org/offices/my-office",
      );
    });

    it("should generate correct document templates URL", () => {
      assert.strictEqual(
        AppUrls.officeDocumentTemplates("my-org", "my-office"),
        "/organizations/my-org/offices/my-office/templates/document",
      );
    });

    it("should generate correct project templates URL", () => {
      assert.strictEqual(
        AppUrls.officeProjectTemplates("my-org", "my-office"),
        "/organizations/my-org/offices/my-office/templates",
      );
    });
  });

  describe("project routes", () => {
    const orgSlug = "my-org";
    const officeSlug = "my-office";
    const projectSlug = "my-project";

    it("should generate correct project URL", () => {
      assert.strictEqual(
        AppUrls.project(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project",
      );
    });

    it("should generate correct project overview URL", () => {
      assert.strictEqual(
        AppUrls.projectOverview(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project/overview",
      );
    });

    it("should generate correct project chat URL", () => {
      assert.strictEqual(
        AppUrls.projectChat(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project/chat",
      );
    });

    it("should generate correct project tasks URL", () => {
      assert.strictEqual(
        AppUrls.projectTasks(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project/tasks",
      );
    });

    it("should generate correct project map URL", () => {
      assert.strictEqual(
        AppUrls.projectMap(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project/map",
      );
    });

    it("should generate correct project documents URL", () => {
      assert.strictEqual(
        AppUrls.projectDocuments(orgSlug, officeSlug, projectSlug),
        "/organizations/my-org/offices/my-office/projects/my-project/documents",
      );
    });
  });

  describe("projectSubroutes", () => {
    const orgSlug = "test-org";
    const officeSlug = "test-office";
    const projectSlug = "test-project";

    it("should return all project subroutes", () => {
      const subroutes = AppUrls.projectSubroutes(
        orgSlug,
        officeSlug,
        projectSlug,
      );

      assert.strictEqual(subroutes.length, 12);
    });

    it("should include base project route", () => {
      const subroutes = AppUrls.projectSubroutes(
        orgSlug,
        officeSlug,
        projectSlug,
      );
      const expectedBase =
        "/organizations/test-org/offices/test-office/projects/test-project";

      assert.ok(subroutes.includes(expectedBase));
    });

    it("should include all expected subroutes", () => {
      const subroutes = AppUrls.projectSubroutes(
        orgSlug,
        officeSlug,
        projectSlug,
      );
      const base =
        "/organizations/test-org/offices/test-office/projects/test-project";

      assert.ok(subroutes.includes(base));
      assert.ok(subroutes.includes(`${base}/overview`));
      assert.ok(subroutes.includes(`${base}/chat`));
      assert.ok(subroutes.includes(`${base}/chats`));
      assert.ok(subroutes.includes(`${base}/tasks`));
      assert.ok(subroutes.includes(`${base}/timeline`));
      assert.ok(subroutes.includes(`${base}/map`));
      assert.ok(subroutes.includes(`${base}/documents`));
      assert.ok(subroutes.includes(`${base}/comments`));
      assert.ok(subroutes.includes(`${base}/members`));
    });
  });

  describe("URL consistency", () => {
    it("should build office URL using organization prefix", () => {
      const orgUrl = AppUrls.organization("org");
      const officeUrl = AppUrls.office("org", "office");

      assert.ok(officeUrl.startsWith(orgUrl));
    });

    it("should build project URL using office prefix", () => {
      const officeUrl = AppUrls.office("org", "office");
      const projectUrl = AppUrls.project("org", "office", "project");

      assert.ok(projectUrl.startsWith(officeUrl));
    });

    it("should maintain consistent URL hierarchy", () => {
      const org = "acme-corp";
      const office = "headquarters";
      const project = "q4-planning";

      const orgUrl = AppUrls.organization(org);
      const officeUrl = AppUrls.office(org, office);
      const projectUrl = AppUrls.project(org, office, project);
      const chatUrl = AppUrls.projectChat(org, office, project);

      // Verify hierarchy: each level contains the previous
      assert.ok(officeUrl.startsWith(orgUrl));
      assert.ok(projectUrl.startsWith(officeUrl));
      assert.ok(chatUrl.startsWith(projectUrl));
    });
  });
});
