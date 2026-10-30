import { expect, test } from "@playwright/test";

import { ProjectCommentsPage } from "../../pages/project-comments";
import {
  createCitizenProject,
  deleteTrackedProjects,
  shortId,
} from "./project-helpers";

/**
 * The project Comments page. Comments have no edit action: they can be posted,
 * replied to, switched between private and public, and deleted.
 */
test.describe("Project comments", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("posts, replies to, publishes and deletes a comment", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const project = await createCitizenProject("Comments");
    const commentsPage = new ProjectCommentsPage(page);
    const comment = `Field visit notes ${shortId()}`;
    const reply = `Follow-up reply ${shortId()}`;

    await commentsPage.goto(project.path);
    await expect(commentsPage.main.getByText("No comments yet")).toBeVisible();

    // Post: new comments start private (dashboard only).
    await commentsPage.post(comment);
    await page.reload();
    await expect(commentsPage.comment(comment)).toBeVisible({ timeout: 15000 });
    await commentsPage.expectVisibility(comment, false);

    // Reply: kept under the comment after a reload.
    await commentsPage.reply(comment, reply);
    await page.reload();
    const card = commentsPage.comment(comment);
    await expect(
      card.getByRole("button", { name: "1 Reply", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(reply, { exact: true })).toBeVisible();

    // Make public: the visibility icon flips and stays flipped.
    await commentsPage.makePublic(comment);
    await page.reload();
    await commentsPage.expectVisibility(comment, true);

    // Delete: the comment (and its reply) are gone after a reload.
    await commentsPage.delete(comment);
    await page.reload();
    await expect(commentsPage.main.getByText("No comments yet")).toBeVisible({
      timeout: 15000,
    });
    await expect(commentsPage.main.getByText(comment)).toHaveCount(0);
    await expect(commentsPage.main.getByText(reply)).toHaveCount(0);
  });

  test("a comment posted on the comments page shows on the overview", async ({
    page,
  }) => {
    const project = await createCitizenProject("Comments Overview");
    const commentsPage = new ProjectCommentsPage(page);
    const comment = `Overview comment ${shortId()}`;

    await commentsPage.goto(project.path);
    await commentsPage.post(comment);

    await page.goto(project.path);
    await expect(
      page.getByRole("main").getByText(comment, { exact: true }),
    ).toBeVisible({ timeout: 15000 });
  });
});
