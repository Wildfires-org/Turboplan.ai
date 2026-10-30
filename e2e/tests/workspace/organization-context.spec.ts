import { expect, test } from "@playwright/test";

import {
  createOrganizationMemory,
  getOrganizationPrompt,
  listOrganizationMemories,
  upsertOrganizationPrompt,
} from "@wildfires-org/turboplan-db/queries";
import { isEnvValueTruthy } from "@wildfires-org/turboplan-env";
import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import { WorkspaceOrgContextPage } from "../../pages/workspace-org-context";
import {
  addOrganizationViewer,
  createNamedTestUser,
  createTestOrganization,
  createTestUserWithMagicLink,
  getGovWorkspace,
  newAnonymousContext,
  type TestOrganization,
} from "../../utils";

/**
 * Organization Context page (`/:org/context`): the standing AI prompt and the
 * assistant's saved notes. Owners edit both; viewers only read them.
 *
 * The page exists only with the project-context package enabled. The servers
 * get their environment from the same e2e/.env as this process
 * (start-servers.sh), so the flag read here matches theirs: with it on the
 * page tests run, with it off (the e2e default) only the not-found check runs.
 *
 * Runs as the government user; each test gets a fresh BUSINESS organization it
 * owns, so prompts and notes never leak into other specs' AI context.
 */
test.use({ storageState: "./storage/auth/gov.json" });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

const isProjectContextEnabled =
  isEnvValueTruthy(
    process.env.NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED,
  ) || isEnvValueTruthy(process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED);

test.describe("Organization context page", () => {
  test.describe.configure({ timeout: 60000 });

  let ownerId: string;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    ownerId = gov.userId;
  });

  const seedOrganization = (label: string): Promise<TestOrganization> => {
    return createTestOrganization({
      ownerId,
      name: `${label} ${shortId()}`,
    });
  };

  test("is not found while the project-context package is disabled", async ({
    page,
  }) => {
    test.skip(isProjectContextEnabled, "The project-context package is on.");

    const org = await seedOrganization("Context Disabled E2E");
    // The route's loading boundary streams the response before the page calls
    // notFound(), so the HTTP status is 200: check the rendered page instead.
    await page.goto(`${appPaths.organization(org.slug)}/context`);

    await expect(
      page.getByText("Looks like you're off the trail!"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Organization prompt" }),
    ).toHaveCount(0);
  });

  test.describe("with the project-context package enabled", () => {
    test.skip(
      !isProjectContextEnabled,
      "Set NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED=true in e2e/.env.",
    );

    test("saves the organization prompt", async ({ page }) => {
      const org = await seedOrganization("Context Prompt E2E");
      const context = new WorkspaceOrgContextPage(page);
      const prompt = [
        `We are the ${org.name} planning team.`,
        "Cite the code section you rely on.",
      ].join("\n");

      await context.goto(org.slug);
      await expect(context.promptInput).toHaveValue("");
      await expect(context.savePromptButton).toBeDisabled();

      await context.promptInput.fill(prompt);
      await expect(context.savePromptButton).toBeEnabled();
      await context.savePrompt();

      expect((await getOrganizationPrompt(org.id))?.prompt).toBe(prompt);

      await page.reload();
      await expect(context.promptInput).toHaveValue(prompt, { timeout: 15000 });
      // Nothing is dirty after a fresh load.
      await expect(context.savePromptButton).toBeDisabled();
    });

    test("Discard changes restores the saved prompt", async ({ page }) => {
      const org = await seedOrganization("Context Discard E2E");
      const savedPrompt = `Saved prompt ${shortId()}`;
      await upsertOrganizationPrompt({
        organizationId: org.id,
        prompt: savedPrompt,
        userId: ownerId,
      });
      const context = new WorkspaceOrgContextPage(page);

      await context.goto(org.slug);
      await expect(context.promptInput).toHaveValue(savedPrompt);

      await context.promptInput.fill("An edit that will be discarded");
      await context.discardChangesButton.click();

      await expect(context.promptInput).toHaveValue(savedPrompt);
      await expect(context.discardChangesButton).toBeHidden();
      await expect(context.savePromptButton).toBeDisabled();

      expect((await getOrganizationPrompt(org.id))?.prompt).toBe(savedPrompt);
      await page.reload();
      await expect(context.promptInput).toHaveValue(savedPrompt, {
        timeout: 15000,
      });
    });

    test("deletes a saved note", async ({ page }) => {
      const org = await seedOrganization("Context Memory E2E");
      const keptNote = `Prefers metric units ${shortId()}`;
      const deletedNote = `Fiscal year starts in July ${shortId()}`;
      for (const content of [keptNote, deletedNote]) {
        await createOrganizationMemory({
          organizationId: org.id,
          content,
          createdBy: ownerId,
        });
      }
      const context = new WorkspaceOrgContextPage(page);

      await context.goto(org.slug);
      await expect(context.note(keptNote)).toBeVisible({ timeout: 15000 });
      await expect(context.note(deletedNote)).toBeVisible();

      await context.deleteNoteButton(deletedNote).click();
      await expect(context.note(deletedNote)).toHaveCount(0);

      await expect
        .poll(async () =>
          (await listOrganizationMemories(org.id)).map((note) => note.content),
        )
        .toEqual([keptNote]);

      await page.reload();
      await expect(context.note(keptNote)).toBeVisible({ timeout: 15000 });
      await expect(context.note(deletedNote)).toHaveCount(0);
    });

    test("a viewer sees the prompt and notes read-only", async ({
      browser,
    }) => {
      const org = await seedOrganization("Context Viewer E2E");
      const prompt = `Viewer-visible prompt ${shortId()}`;
      const note = `Viewer-visible note ${shortId()}`;
      await upsertOrganizationPrompt({
        organizationId: org.id,
        prompt,
        userId: ownerId,
      });
      await createOrganizationMemory({
        organizationId: org.id,
        content: note,
        createdBy: ownerId,
      });

      // A fresh user, so the shared citizen user's organizations stay as they are.
      const viewer = await createNamedTestUser({
        email: `context-viewer-${Date.now()}-${shortId()}@example.test`,
        firstName: "Vera",
        lastName: "Viewer",
      });
      await addOrganizationViewer({
        organizationId: org.id,
        userId: viewer.id,
      });
      const { magicLinkUrl } = await createTestUserWithMagicLink(viewer.email);

      const viewerContext = await newAnonymousContext(browser);
      try {
        const viewerPage = await viewerContext.newPage();
        const contextPath = `${appPaths.organization(org.slug)}/context`;
        await viewerPage.goto(
          `${magicLinkUrl}&redirectTo=${encodeURIComponent(contextPath)}`,
        );
        await viewerPage.waitForURL((url) => url.pathname === contextPath, {
          timeout: 20000,
        });

        const context = new WorkspaceOrgContextPage(viewerPage);
        await context.goto(org.slug);

        await expect(
          context.main.getByText(prompt, { exact: true }),
        ).toBeVisible();
        await expect(context.readOnlyPromptNote).toBeVisible();
        await expect(context.promptInput).toHaveCount(0);
        await expect(context.savePromptButton).toHaveCount(0);

        await expect(context.note(note)).toBeVisible({ timeout: 15000 });
        await expect(context.deleteNoteButton(note)).toHaveCount(0);
      } finally {
        await viewerContext.close();
      }
    });
  });
});
