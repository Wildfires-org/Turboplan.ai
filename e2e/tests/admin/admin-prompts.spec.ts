import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { prompt } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  createPrompt,
  getPromptByName,
  removeAdminUser,
} from "@wildfires-org/turboplan-db/queries";
import { getActivePromptVersion } from "@wildfires-org/turboplan-db/utils";

import { AdminPromptsPage } from "../../pages/admin-panel";
import { createSignedInAdmin, type SignedInAdmin } from "./admin-session";

/**
 * Prompts are shared by the whole instance, so the spec edits a prompt of its
 * own: a name no AI feature looks up, deleted again afterwards.
 */
test.describe("Admin panel - prompts", () => {
  let admin: SignedInAdmin;
  let promptName: string;

  const promptTitle = "E2E admin prompt";
  const initialContent = "You are a test prompt. Initial content.";

  test.beforeAll(async ({ browser }) => {
    admin = await createSignedInAdmin(browser);
    promptName = `e2e-admin-prompt-${Date.now()}`;
    await createPrompt({
      name: promptName,
      title: promptTitle,
      description: "Created by admin-prompts.spec.ts",
      content: initialContent,
      userId: admin.user.id,
    });
  });

  test.afterAll(async () => {
    if (promptName) {
      await db.delete(prompt).where(eq(prompt.name, promptName));
    }
    if (admin) {
      await removeAdminUser(admin.user.id);
    }
  });

  test("an admin's edit to a prompt is saved", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: admin.storageState,
    });
    const page = await context.newPage();
    const prompts = new AdminPromptsPage(page);
    const editedContent = `${initialContent} Edited ${Date.now()}.`;

    await prompts.goto();
    await prompts.openPrompt(promptName, initialContent);
    await prompts.saveContent(editedContent);

    // Saved in place: still one version, now holding the new content.
    const saved = await getPromptByName(promptName);
    expect(saved?.versions).toHaveLength(1);
    expect(getActivePromptVersion(saved?.versions ?? [])?.content).toBe(
      editedContent,
    );

    // And the editor shows it after a reload.
    await page.reload();
    await prompts.openPrompt(promptName, editedContent);
    await context.close();
  });
});
