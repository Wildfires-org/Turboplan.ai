import { expect, type Page, test } from "@playwright/test";

import { getDocumentsById } from "@wildfires-org/turboplan-db/queries";
import {
  createOffice,
  getOfficeById,
  updateOffice,
} from "@wildfires-org/turboplan-workspace/server";

import {
  TurboplanDocumentArtifact,
  TurboplanProjectChatPage,
} from "../../pages";
import {
  createTestProjectInOffice,
  getCitizenWorkspace,
  getTestUserOrganization,
  seedChatDocument,
} from "../../utils";

const shortId = (): string => Math.random().toString(36).substring(2, 8);

const LETTERHEAD_NAME_LINES = ["Department of Testing", "Quality District"];
const DEADLINE_TOKEN = "[INSERT: comment deadline]";
const EMAIL_TOKEN =
  "[INSERT: comment email — suggested: comments@example.test]";
const DEADLINE = "March 3, 2027";

// Two unique placeholders; the deadline token appears twice.
const DOCUMENT_CONTENT = [
  "# Notice of Proposed Action",
  "",
  `Comments are due by ${DEADLINE_TOKEN}.`,
  "",
  `Send comments to ${EMAIL_TOKEN}.`,
  "",
  `Late comments received after ${DEADLINE_TOKEN} may not be considered.`,
].join("\n");

/** The latest saved version of a document. */
const getLatestContent = async (documentId: string): Promise<string> => {
  const versions = await getDocumentsById({ id: documentId });
  return versions.at(-1)?.content ?? "";
};

/**
 * A chat document's letterhead picker and "Fill placeholders" panel.
 *
 * The document is seeded in the DB as a finished createDocument tool call (no
 * model involved) in a project of a dedicated office with a letterhead, so the
 * band, the picker's default option and remembered facts stay local to this
 * spec. Runs as the citizen user, who owns that office's organization.
 */
test.describe("Document letterhead picker and placeholders", () => {
  test.setTimeout(60_000);

  let orgSlug: string;
  let officeId: string;
  let officeSlug: string;
  let userId: string;
  let project: { id: string; slug: string };

  test.beforeAll(async () => {
    const workspace = await getCitizenWorkspace();
    userId = workspace.userId;
    orgSlug = workspace.orgSlug;
    const organization = await getTestUserOrganization(userId);
    if (!organization) {
      throw new Error("Citizen organization not found");
    }

    const office = await createOffice({
      name: `Document Office ${shortId()}`,
      organizationId: organization.id,
      createdBy: userId,
    });
    await updateOffice({
      id: office.id,
      documentLetterheadLayout: "split",
      documentLetterheadLines: LETTERHEAD_NAME_LINES.join("\n"),
      documentLetterheadContact: "1 Test Plaza",
    });
    officeId = office.id;
    officeSlug = office.slug;

    project = await createTestProjectInOffice({
      name: `Document Project ${shortId()}`,
      officeId: office.id,
      createdBy: userId,
    });
  });

  test.beforeEach(async ({ page }) => {
    // Safety net: nothing here may reach the model-backed chat endpoint.
    await page.route(
      (url) => url.pathname === "/api/chat",
      (route) =>
        route.request().method() === "POST" ? route.abort() : route.fallback(),
    );
  });

  const openSeededDocument = async (page: Page, title: string) => {
    const { chatId, documentId } = await seedChatDocument({
      userId,
      projectId: project.id,
      title,
      content: DOCUMENT_CONTENT,
    });

    const chatPage = new TurboplanProjectChatPage(page);
    await chatPage.goto({
      orgSlug,
      officeSlug,
      projectSlug: project.slug,
      chatId,
    });

    const artifact = new TurboplanDocumentArtifact(page);
    await artifact.openFromChatPreview(title);
    return { artifact, documentId };
  };

  test("fills placeholders and remembers a value for the office", async ({
    page,
  }) => {
    const { artifact, documentId } = await openSeededDocument(
      page,
      `Placeholder notice ${shortId()}`,
    );

    // The badge counts unique placeholders.
    await expect(artifact.fillPlaceholdersButton).toHaveText("2");
    await artifact.fillPlaceholdersButton.click();
    await expect(artifact.placeholdersSheet).toBeVisible();

    // Fill one placeholder: every occurrence is replaced and saved.
    const deadlineItem = artifact.placeholderItem("Comment deadline");
    await deadlineItem.getByLabel("Comment deadline").fill(DEADLINE);
    await deadlineItem.getByRole("button", { name: "Apply" }).click();

    await expect(deadlineItem).toHaveCount(0);
    await expect
      .poll(() => getLatestContent(documentId), { timeout: 15000 })
      .not.toContain(DEADLINE_TOKEN);
    const filled = await getLatestContent(documentId);
    expect(filled.split(DEADLINE).length - 1).toBe(2);
    expect(filled).toContain(EMAIL_TOKEN);

    // Apply the suggested value and remember it for the office.
    const emailItem = artifact.placeholderItem("Comment email");
    await expect(emailItem.getByLabel("Comment email")).toHaveValue(
      "comments@example.test",
    );
    await emailItem.getByLabel("Remember for this office").check();
    await emailItem.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText("Saved to office details")).toBeVisible();
    await expect(artifact.placeholdersSheet).toContainText(
      "All placeholders are filled.",
    );
    await expect
      .poll(() => getLatestContent(documentId), { timeout: 15000 })
      .not.toContain(EMAIL_TOKEN);
    await expect
      .poll(
        async () =>
          (await getOfficeById(officeId))?.documentProfile?.facts ?? "",
      )
      .toContain("Comment email: comments@example.test");

    // With nothing left to fill, the header button goes away.
    await artifact.placeholdersSheet
      .getByRole("button", { name: "Close" })
      .click();
    await expect(artifact.placeholdersSheet).toBeHidden();
    await expect(artifact.panel).toContainText(DEADLINE);
    await expect(artifact.fillPlaceholdersButton).toHaveCount(0);
  });

  test("switches the document letterhead to None and back", async ({
    page,
  }) => {
    const title = `Letterhead notice ${shortId()}`;
    const { artifact } = await openSeededDocument(page, title);
    const defaultOption = `Default — ${LETTERHEAD_NAME_LINES[0]}`;

    // Default: the office letterhead is shown above the document.
    await expect(artifact.letterheadBand).toBeVisible({ timeout: 15000 });
    await expect(artifact.letterheadBand).toContainText(
      LETTERHEAD_NAME_LINES[0],
    );
    await artifact.expectSelectedLetterhead(defaultOption);

    await artifact.chooseLetterhead("None");
    await expect(artifact.letterheadBand).toBeHidden();

    // The choice is stored per document, so it survives a reload.
    await page.reload();
    await artifact.openFromChatPreview(title);
    await artifact.expectSelectedLetterhead("None");
    await expect(artifact.letterheadBand).toBeHidden();

    await artifact.chooseLetterhead(defaultOption);
    await expect(artifact.letterheadBand).toBeVisible();
    await expect(artifact.letterheadBand).toContainText(
      LETTERHEAD_NAME_LINES[1],
    );
  });
});
