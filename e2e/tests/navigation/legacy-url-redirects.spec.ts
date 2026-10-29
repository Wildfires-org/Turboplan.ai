import { expect, type Page, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";
import { updateProject } from "@wildfires-org/turboplan-workspace/server";

import {
  createTestProjectInOffice,
  getCitizenWorkspace,
  newAnonymousContext,
  type WorkspaceInfo,
} from "../../utils";

const NOT_FOUND_HEADING = "Looks like you're off the trail!";

const shortId = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

const legacyOrgPath = (orgSlug: string): string => {
  return `/organizations/${orgSlug}`;
};

const legacyOfficePath = (orgSlug: string, officeSlug: string): string => {
  return `${legacyOrgPath(orgSlug)}/offices/${officeSlug}`;
};

const legacyProjectPath = (
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): string => {
  return `${legacyOfficePath(orgSlug, officeSlug)}/projects/${projectSlug}`;
};

const expectNotFoundPage = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole("heading", { name: NOT_FOUND_HEADING }),
  ).toBeVisible({ timeout: 15000 });
};

/**
 * Dashboard URLs used to be `/organizations/:org/offices/:office/projects/:project`.
 * They are now flat (`/:org/:office/:project`), and next.config.ts redirects
 * (308) the old shape so bookmarks and links in old emails keep working.
 *
 * `page` is signed in as the citizen user, who owns their personal office.
 */
test.describe("Legacy dashboard URL redirects", () => {
  let workspace: WorkspaceInfo;
  let project: { id: string; name: string; slug: string };

  test.beforeAll(async () => {
    workspace = await getCitizenWorkspace();
    project = await createTestProjectInOffice({
      name: `Legacy Redirect ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });
  });

  test("redirects a project subpage and keeps the query string", async ({
    page,
  }) => {
    const { orgSlug, officeSlug } = workspace;

    await page.goto(
      `${legacyProjectPath(orgSlug, officeSlug, project.slug)}/tasks?view=x`,
    );

    await expect(page).toHaveURL(
      `${appPaths.project(orgSlug, officeSlug, project.slug)}/tasks?view=x`,
    );
    await expect(
      page.getByRole("heading", { name: project.name }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("redirects the project page itself", async ({ page }) => {
    const { orgSlug, officeSlug } = workspace;

    await page.goto(legacyProjectPath(orgSlug, officeSlug, project.slug));

    await expect(page).toHaveURL(
      appPaths.project(orgSlug, officeSlug, project.slug),
    );
  });

  test("redirects office pages", async ({ page }) => {
    const { orgSlug, officeSlug } = workspace;
    const officePath = appPaths.office(orgSlug, officeSlug);

    await page.goto(legacyOfficePath(orgSlug, officeSlug));
    await expect(page).toHaveURL(officePath);

    await page.goto(`${legacyOfficePath(orgSlug, officeSlug)}/members`);
    await expect(page).toHaveURL(`${officePath}/members`);
  });

  test("redirects organization pages, with or without a trailing slash", async ({
    page,
  }) => {
    const { orgSlug } = workspace;
    const orgPath = appPaths.organization(orgSlug);

    await page.goto(legacyOrgPath(orgSlug));
    await expect(page).toHaveURL(orgPath);

    await page.goto(`${legacyOrgPath(orgSlug)}/`);
    await expect(page).toHaveURL(orgPath);

    await page.goto(`${legacyOrgPath(orgSlug)}/members`);
    await expect(page).toHaveURL(`${orgPath}/members`);
  });

  test("answers with a permanent redirect to the flat path", async ({
    request,
  }) => {
    const { orgSlug, officeSlug } = workspace;

    const response = await request.get(
      `${legacyProjectPath(orgSlug, officeSlug, project.slug)}/tasks?view=x`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    const location = new URL(response.headers().location ?? "", response.url());
    expect(`${location.pathname}${location.search}`).toBe(
      `${appPaths.project(orgSlug, officeSlug, project.slug)}/tasks?view=x`,
    );
  });

  test("sends a signed-out visitor to login via the flat path", async ({
    browser,
  }) => {
    const { orgSlug, officeSlug } = workspace;
    const context = await newAnonymousContext(browser);
    const page = await context.newPage();

    // Record every top-level document request, redirect hops included.
    const documentPaths: string[] = [];
    page.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentPaths.push(new URL(request.url()).pathname);
      }
    });

    await page.goto(
      `${legacyProjectPath(orgSlug, officeSlug, project.slug)}/tasks`,
    );

    // The redirect runs before auth, so the visitor reaches login by way of
    // the flat URL, never the legacy one.
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    expect(documentPaths).toContain(
      `${appPaths.project(orgSlug, officeSlug, project.slug)}/tasks`,
    );
    // Today the dashboard layout sends signed-out visitors to a bare /login;
    // should a callbackUrl be added, it must not point at the legacy URL.
    const callbackUrl = new URL(page.url()).searchParams.get("callbackUrl");
    if (callbackUrl) {
      expect(callbackUrl).not.toContain("/organizations/");
    }

    await context.close();
  });

  test("404s on the bare legacy prefixes", async ({ page }) => {
    await page.goto("/organizations");
    await expectNotFoundPage(page);
    await expect(page).toHaveURL("/organizations");

    const officesPath = `${appPaths.organization(workspace.orgSlug)}/offices`;
    await page.goto(officesPath);
    await expectNotFoundPage(page);
    await expect(page).toHaveURL(officesPath);
  });

  test("follows a renamed project slug from a legacy URL", async ({ page }) => {
    const { orgSlug, officeSlug } = workspace;
    const renamed = await createTestProjectInOffice({
      name: `Legacy Rename ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });
    const newSlug = `${renamed.slug}-renamed`;
    await updateProject({
      id: renamed.id,
      slug: newSlug,
      lastModifiedBy: workspace.userId,
    });

    await page.goto(
      `${legacyProjectPath(orgSlug, officeSlug, renamed.slug)}/tasks`,
    );

    await expect(page).toHaveURL(
      `${appPaths.project(orgSlug, officeSlug, newSlug)}/tasks`,
      { timeout: 15000 },
    );
  });
});
