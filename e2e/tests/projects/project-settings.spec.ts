import { expect, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import { OFFICE_URL_PATTERN, PROJECT_URL_PATTERN } from "../../config/patterns";
import { TEST_WORKSPACE } from "../../config/test-data";
import { ProjectEditDialog } from "../../pages/project-edit-dialog";
import { TurboplanProjectPage } from "../../pages/turboplan-project";
import {
  getCitizenWorkspace,
  mockGenerateTitles,
  mockProjectChatApi,
} from "../../utils";
import {
  createCitizenProject,
  deleteTrackedProjects,
  getProjectRowByName,
  shortId,
  trackProjectForCleanup,
} from "./project-helpers";

/**
 * Creating a project from the office page, then editing its name, description,
 * dates and status in the "Edit project" dialog. A rename changes the slug; the
 * old URL must keep working by redirecting to the new one.
 */
test.describe("Project settings", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("creates a project, edits its details and redirects the old slug", async ({
    page,
  }) => {
    test.setTimeout(90000);

    const workspace = await getCitizenWorkspace();
    const originalName = `Settings ${shortId()}`;
    const renamed = `Renamed ${shortId()}`;
    const description = `Edited description ${shortId()}`;

    // Create the project through the UI. Title generation is mocked, and so
    // is the chat the new project opens with, so no model is called.
    await mockProjectChatApi(page, {
      chatId: "unused",
      replyText: "Mocked reply for the project setup prompt.",
    });
    await page.goto(appPaths.office(workspace.orgSlug, workspace.officeSlug));
    await page.waitForURL(OFFICE_URL_PATTERN, { timeout: 10000 });
    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    await page.getByLabel("Project Prompt").fill(TEST_WORKSPACE.PROJECT_PROMPT);
    const unmockGenerateTitles = await mockGenerateTitles(page, originalName);
    await page.getByRole("button", { name: /Create Project/i }).click();
    await page.waitForURL(PROJECT_URL_PATTERN, { timeout: 20000 });
    await unmockGenerateTitles();

    // Creation lands on the project's first chat; edits happen on the overview.
    const created = await getProjectRowByName(originalName);
    if (!created) {
      throw new Error(`Project "${originalName}" was not stored`);
    }
    trackProjectForCleanup(created.id, workspace.userId);
    const originalPath = appPaths.project(
      workspace.orgSlug,
      workspace.officeSlug,
      created.slug,
    );
    await page.goto(originalPath);
    const projectPage = new TurboplanProjectPage(page);
    await projectPage.expectHeading(originalName);
    const originalUrl = page.url();

    // Edit every field of the dialog.
    const editDialog = new ProjectEditDialog(page);
    await editDialog.open();
    await expect(editDialog.nameInput).toHaveValue(originalName);
    await editDialog.fill({
      name: renamed,
      description,
      startDate: "2027-01-15",
      endDate: "2027-06-30",
      status: "Completed",
    });
    await editDialog.save();

    // A rename moves the project to a new slug.
    await expect(page).not.toHaveURL(originalUrl, { timeout: 10000 });
    await expect(page).toHaveURL(PROJECT_URL_PATTERN);
    const renamedUrl = page.url();

    // Everything survives a reload.
    await page.reload();
    await projectPage.expectHeading(renamed);
    const main = page.getByRole("main");
    await expect(main.getByText(description, { exact: true })).toBeVisible();
    await expect(main.getByText(/due: June 30, 2027/)).toBeVisible();

    await editDialog.open();
    await expect(editDialog.nameInput).toHaveValue(renamed);
    await expect(editDialog.descriptionInput).toHaveValue(description);
    await expect(editDialog.startDateInput).toHaveValue("2027-01-15");
    await expect(editDialog.endDateInput).toHaveValue("2027-06-30");
    await expect(editDialog.statusSelect).toHaveText("Completed");
    await page.keyboard.press("Escape");
    await expect(editDialog.dialog).toBeHidden();

    const stored = await getProjectRowByName(renamed);
    expect(stored?.id).toBe(created.id);
    expect(stored?.status).toBe("completed");
    expect(stored?.description).toBe(description);
    expect(stored?.slug).not.toBe(created.slug);
    expect(renamedUrl).toContain(`/${stored?.slug}`);

    // The old slug redirects to the new one.
    await page.goto(originalUrl);
    await expect(page).toHaveURL(renamedUrl, { timeout: 10000 });
    await projectPage.expectHeading(renamed);

    // So does a sub-page under the old slug.
    await page.goto(`${originalUrl}/comments`);
    await expect(page).toHaveURL(`${renamedUrl}/comments`, { timeout: 10000 });
  });

  test("the /overview path redirects to the project page", async ({ page }) => {
    const project = await createCitizenProject("Overview");
    const projectUrl = project.path;
    const name = project.name;
    const description = `E2E project for Overview`;

    await page.goto(`${projectUrl}/overview`);
    await expect(page).toHaveURL(new RegExp(`${projectUrl}$`), {
      timeout: 10000,
    });

    const projectPage = new TurboplanProjectPage(page);
    await projectPage.expectHeading(name);
    const main = page.getByRole("main");
    await expect(main.getByText(description, { exact: true })).toBeVisible();

    // The overview shows the project's module sections.
    for (const section of [
      "Map",
      "Tasks",
      "Comments",
      "Documents",
      "Timeline",
    ]) {
      await expect(
        main.getByRole("heading", { name: section, level: 2 }),
      ).toBeVisible();
    }

    // The breadcrumb's last crumb is the project itself (plain text).
    await expect(
      main.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText(name);
  });
});
