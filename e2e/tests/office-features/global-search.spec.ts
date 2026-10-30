import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import { project } from "@wildfires-org/turboplan-db/schemas";

import { OfficeFeaturesCatalogSearch } from "../../pages/office-features-catalog-search";
import {
  createTestProjectInOffice,
  getGovWorkspace,
  type WorkspaceInfo,
} from "../../utils";

/**
 * Global search (the `turboplan-search` OmniSearch). The web app has no global
 * search; the package is mounted on the landing page's public catalog, where
 * it searches public organizations, offices, projects and templates.
 *
 * Seeds a public and a private project in the gov user's GOVERNMENT office
 * (only government/environmental-planner orgs are publicly listed), both
 * named with this run's unique marker.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const MARKER = `qx${Math.random().toString(36).substring(2, 8)}`;
const PUBLIC_NAME = `${MARKER} Riverbank Restoration`;
const PRIVATE_NAME = `${MARKER} Riverbank Survey`;

type SearchResponse = {
  results: Array<{ type: string; name: string; url: string }>;
};

test.describe("Global search", () => {
  test.setTimeout(60_000);

  let workspace: WorkspaceInfo;
  let publicProjectHref: string;
  let privateProjectHref: string;

  test.beforeAll(async () => {
    workspace = await getGovWorkspace();

    const [publicProject, privateProject] = await Promise.all(
      [PUBLIC_NAME, PRIVATE_NAME].map((name) =>
        createTestProjectInOffice({
          name,
          description: "E2E global search fixture",
          officeId: workspace.officeId,
          createdBy: workspace.userId,
        }),
      ),
    );
    await db
      .update(project)
      .set({ isPublic: true })
      .where(eq(project.id, publicProject.id));

    const officePath = `/projects/${workspace.orgSlug}/${workspace.officeSlug}`;
    publicProjectHref = `${officePath}/${publicProject.slug}`;
    privateProjectHref = `${officePath}/${privateProject.slug}`;
  });

  test("finds a public project by name and opens it", async ({ page }) => {
    const search = new OfficeFeaturesCatalogSearch(page);
    await search.goto();
    await search.search(PUBLIC_NAME);

    const result = search.getResultByHref(publicProjectHref);
    await expect(result).toBeVisible({ timeout: 15000 });
    await expect(result).toContainText(PUBLIC_NAME);

    await result.click();
    await page.waitForURL((url) => url.pathname === publicProjectHref, {
      timeout: 15000,
    });
    await expect(page.getByText(PUBLIC_NAME).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("does not return a private project with a matching name", async ({
    page,
    request,
  }) => {
    // The search API is the source of the dropdown: public match only.
    const response = await request.get(
      `${SERVER_URL}/api/search?q=${encodeURIComponent(MARKER)}`,
    );
    expect(response.status()).toBe(200);
    const { results } = (await response.json()) as SearchResponse;
    const urls = results.map((result) => result.url);
    expect(urls).toContain(publicProjectHref);
    expect(urls).not.toContain(privateProjectHref);

    // The same in the UI, with the query restored from the URL on load.
    const search = new OfficeFeaturesCatalogSearch(page);
    await search.goto(MARKER);
    await expect(search.getSearchInput()).toHaveValue(MARKER);
    await search.getSearchInput().click();

    await expect(search.getResultByHref(publicProjectHref)).toBeVisible({
      timeout: 15000,
    });
    await expect(search.getResultByHref(privateProjectHref)).toHaveCount(0);
  });
});
