import { expect, test } from "@playwright/test";

import { GOV_WORKSPACE, TEST_WORKSPACE } from "../../config/test-data";
import { TurboplanDashboardPage, TurboplanProjectPage } from "../../pages";
import { newAnonymousContext } from "../../utils";

const LANDING_URL = process.env.LANDING_PAGE_URL || "http://localhost:3002";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

type PublicProject = {
  name: string;
  slug: string;
  office: {
    name: string;
    slug: string;
  };
  organization: {
    name: string;
    slug: string;
  };
};

/**
 * Public Catalog Visibility tests.
 *
 * Verifies that:
 * - Gov users can toggle project visibility (public/private)
 * - Public projects appear in the landing page catalog
 * - Non-public projects do NOT appear in the landing page catalog
 * - Citizens can browse public projects from the landing page
 *
 * Uses serial execution because the first test makes the gov project public
 * and subsequent tests depend on that state.
 */
test.describe
  .serial("Public Catalog Visibility", () => {
    // Serial suite; the trailing cleanup test can starve under full parallel
    // load. Give all tests headroom over the default 30s.
    test.setTimeout(60_000);

    test("gov user can make their project public", async ({ browser }) => {
      const govContext = await browser.newContext({
        storageState: "./storage/auth/gov.json",
      });
      const govPage = await govContext.newPage();
      const dashboard = new TurboplanDashboardPage(govPage);
      const project = new TurboplanProjectPage(govPage);

      await dashboard.goto();
      const makePublicLink = govPage
        .getByRole("link", { name: GOV_WORKSPACE.PROJECT_NAME })
        .first();
      await expect(makePublicLink).toBeVisible({ timeout: 10000 });
      await makePublicLink.click();

      await project.makePublic();
      await project.expectPublishedButton();

      await govContext.close();
    });

    test("public project appears in the landing page catalog", async ({
      browser,
      request,
    }) => {
      const response = await request.get(`${SERVER_URL}/api/public/projects`);
      expect(response.status()).toBe(200);

      const projects = (await response.json()) as PublicProject[];
      const govProject = projects.find(
        (project) => project.name === GOV_WORKSPACE.PROJECT_NAME,
      );

      if (!govProject) {
        throw new Error("Expected gov project to be returned by public API");
      }

      const officeCatalogUrl = `${LANDING_URL}/projects/${govProject.organization.slug}/${govProject.office.slug}/projects`;
      const projectHref = `/projects/${govProject.organization.slug}/${govProject.office.slug}/${govProject.slug}`;

      const publicContext = await newAnonymousContext(browser);
      const publicPage = await publicContext.newPage();

      await publicPage.goto(officeCatalogUrl);
      await publicPage.waitForLoadState("networkidle");

      const projectCard = publicPage
        .locator(`a[href="${projectHref}"]`)
        .filter({
          has: publicPage.getByText(govProject.name, { exact: true }),
        });

      await expect(projectCard).toBeVisible({ timeout: 15000 });
      await expect(projectCard).toContainText(govProject.name);
      await expect(projectCard).toContainText(
        `${govProject.organization.name} / ${govProject.office.name}`,
      );

      await publicContext.close();
    });

    test("public project is returned by the public API", async ({
      request,
    }) => {
      const response = await request.get(`${SERVER_URL}/api/public/projects`);

      expect(response.status()).toBe(200);

      const projects = (await response.json()) as PublicProject[];
      const govProject = projects.find(
        (project) => project.name === GOV_WORKSPACE.PROJECT_NAME,
      );

      if (!govProject) {
        throw new Error("Expected gov project to be returned by public API");
      }

      expect(govProject.organization.name).toBeTruthy();
      expect(govProject.office.name).toBeTruthy();
    });

    test("non-public projects do NOT appear in the public API", async ({
      request,
    }) => {
      const response = await request.get(`${SERVER_URL}/api/public/projects`);

      expect(response.status()).toBe(200);

      const projects = (await response.json()) as PublicProject[];
      const citizenProject = projects.find(
        (project) => project.name === TEST_WORKSPACE.PROJECT_NAME,
      );

      expect(citizenProject).toBeUndefined();
    });

    test("citizen can see public gov project on the landing page catalog", async ({
      page,
      request,
    }) => {
      const response = await request.get(`${SERVER_URL}/api/public/projects`);
      expect(response.status()).toBe(200);

      const projects = (await response.json()) as PublicProject[];
      const govProject = projects.find(
        (project) => project.name === GOV_WORKSPACE.PROJECT_NAME,
      );

      if (!govProject) {
        throw new Error("Expected gov project to be returned by public API");
      }

      const officeCatalogUrl = `${LANDING_URL}/projects/${govProject.organization.slug}/${govProject.office.slug}/projects`;
      const projectHref = `/projects/${govProject.organization.slug}/${govProject.office.slug}/${govProject.slug}`;

      await page.goto(officeCatalogUrl);
      await page.waitForLoadState("networkidle");

      const projectCard = page
        .locator(`a[href="${projectHref}"]`)
        .filter({ has: page.getByText(govProject.name, { exact: true }) });

      await expect(projectCard).toBeVisible({ timeout: 15000 });
      await expect(projectCard).toContainText(govProject.name);
      await expect(projectCard).toContainText(
        `${govProject.organization.name} / ${govProject.office.name}`,
      );
    });

    test("cleanup: gov user makes project private again", async ({
      browser,
    }) => {
      const govContext = await browser.newContext({
        storageState: "./storage/auth/gov.json",
      });
      const govPage = await govContext.newPage();
      const dashboard = new TurboplanDashboardPage(govPage);
      const project = new TurboplanProjectPage(govPage);

      await dashboard.goto();
      const makePrivateLink = govPage
        .getByRole("link", { name: GOV_WORKSPACE.PROJECT_NAME })
        .first();
      await expect(makePrivateLink).toBeVisible({ timeout: 20000 });
      await makePrivateLink.click();

      await project.makePrivate();

      await govContext.close();
    });
  });
