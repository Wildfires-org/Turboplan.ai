import assert from "node:assert";
import { describe, it } from "node:test";

import {
  getOfficeCatalogUrl,
  getOrganizationCatalogUrl,
  getOrganizationDashboardUrl,
  getProjectCatalogUrl,
} from "../src/utils/entity-urls.js";

// Separate file from entity-urls.test.ts on purpose: getCommonEnv caches the
// env on first call, and node --test runs each file in its own process — the
// only way to exercise the unset-LANDING_URL branch.
process.env.AUTH_SECRET = "test-secret";
process.env.POSTGRES_URL = "postgresql://test";
process.env.TURBOPLAN_URL = "https://app.example.test";
delete process.env.LANDING_URL;
process.env.IS_TASKS_PACKAGE_ENABLED = "false";
process.env.IS_MAPS_PACKAGE_ENABLED = "false";
process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED = "false";
process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED = "false";

describe("without LANDING_URL", () => {
  it("catalog builders return null", () => {
    assert.strictEqual(getOrganizationCatalogUrl("blm"), null);
    assert.strictEqual(getOfficeCatalogUrl("blm", "office"), null);
    assert.strictEqual(getProjectCatalogUrl("blm", "office", "proj"), null);
  });

  it("dashboard builders still work", () => {
    assert.strictEqual(
      getOrganizationDashboardUrl("blm"),
      "https://app.example.test/organizations/blm",
    );
  });
});
