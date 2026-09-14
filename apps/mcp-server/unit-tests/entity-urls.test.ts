import assert from "node:assert";
import { describe, it } from "node:test";

import {
  getOfficeCatalogUrl,
  getOfficeDashboardUrl,
  getOrganizationCatalogUrl,
  getOrganizationDashboardUrl,
  getProjectCatalogUrl,
  getProjectDashboardUrl,
} from "../src/utils/entity-urls.js";

// getCommonEnv caches on first call, so the full env must be in place before
// any builder runs. The no-LANDING_URL branch lives in its own test file
// (entity-urls-no-landing.test.ts) because of that same cache.
process.env.AUTH_SECRET = "test-secret";
process.env.POSTGRES_URL = "postgresql://test";
process.env.TURBOPLAN_URL = "https://app.example.test/";
process.env.LANDING_URL = "https://landing.example.test/";
process.env.IS_TASKS_PACKAGE_ENABLED = "false";
process.env.IS_MAPS_PACKAGE_ENABLED = "false";
process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED = "false";
process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED = "false";

describe("catalog URLs", () => {
  it("builds organization URL and strips trailing slash from base", () => {
    assert.strictEqual(
      getOrganizationCatalogUrl("blm"),
      "https://landing.example.test/catalog/blm",
    );
  });

  it("builds office URL", () => {
    assert.strictEqual(
      getOfficeCatalogUrl("blm", "shoshone-field-office"),
      "https://landing.example.test/catalog/blm/shoshone-field-office",
    );
  });

  it("builds project URL", () => {
    assert.strictEqual(
      getProjectCatalogUrl("blm", "shoshone-field-office", "lava-ridge"),
      "https://landing.example.test/catalog/blm/shoshone-field-office/lava-ridge",
    );
  });
});

describe("dashboard URLs", () => {
  it("builds organization URL and strips trailing slash from base", () => {
    assert.strictEqual(
      getOrganizationDashboardUrl("blm"),
      "https://app.example.test/organizations/blm",
    );
  });

  it("builds office URL", () => {
    assert.strictEqual(
      getOfficeDashboardUrl("blm", "shoshone-field-office"),
      "https://app.example.test/organizations/blm/offices/shoshone-field-office",
    );
  });

  it("builds project URL", () => {
    assert.strictEqual(
      getProjectDashboardUrl("blm", "shoshone-field-office", "lava-ridge"),
      "https://app.example.test/organizations/blm/offices/shoshone-field-office/projects/lava-ridge",
    );
  });
});

describe("slug encoding", () => {
  it("encodes path, query, and fragment characters in slugs", () => {
    assert.strictEqual(
      getOrganizationCatalogUrl("a/b?c#d"),
      "https://landing.example.test/catalog/a%2Fb%3Fc%23d",
    );
  });

  it("encodes spaces and non-ASCII characters", () => {
    assert.strictEqual(
      getProjectDashboardUrl("org", "off ice", "zażółć"),
      "https://app.example.test/organizations/org/offices/off%20ice/projects/za%C5%BC%C3%B3%C5%82%C4%87",
    );
  });

  it("leaves valid slugs untouched", () => {
    assert.strictEqual(
      getOfficeCatalogUrl("blm-123", "moab-field-office"),
      "https://landing.example.test/catalog/blm-123/moab-field-office",
    );
  });
});
