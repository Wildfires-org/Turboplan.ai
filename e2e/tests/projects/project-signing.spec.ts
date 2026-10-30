import { expect, test } from "@playwright/test";

import {
  createCitizenProject,
  deleteTrackedProjects,
  isModuleEnabled,
} from "./project-helpers";

const isSigningEnabled = isModuleEnabled("IS_SIGNING_PACKAGE_ENABLED");

/**
 * The project Signing page (`/signing`). The signing module is off in the
 * default E2E `.env` (it needs Documenso), so most runs check the disabled
 * state; the enabled check runs when IS_SIGNING_PACKAGE_ENABLED=true.
 */
test.describe("Project signing", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("loads the signing requests list when signing is on", async ({
    page,
  }) => {
    test.skip(!isSigningEnabled, "Signing module is disabled");

    const project = await createCitizenProject("Signing On");
    await page.goto(project.path);
    await page.getByRole("link", { name: "Signing", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${project.path}/signing$`));

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Signing Requests" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(main.getByText("No signing requests yet")).toBeVisible();
  });

  test("hides the Signing link when signing is off", async ({ page }) => {
    test.skip(isSigningEnabled, "Signing module is enabled");

    const project = await createCitizenProject("Signing Off Nav");
    await page.goto(project.path);

    // The project's module links have rendered...
    await expect(
      page.getByRole("link", { name: "Members", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    // ...without one for signing.
    await expect(
      page.getByRole("link", { name: "Signing", exact: true }),
    ).toHaveCount(0);
  });

  test("the signing URL is not found when signing is off", async ({ page }) => {
    test.skip(isSigningEnabled, "Signing module is enabled");
    const project = await createCitizenProject("Signing Off Url");
    await page.goto(`${project.path}/signing`);

    await expect(
      page.getByRole("heading", { name: "Looks like you're off the trail!" }),
    ).toBeVisible({ timeout: 15000 });
  });
});
