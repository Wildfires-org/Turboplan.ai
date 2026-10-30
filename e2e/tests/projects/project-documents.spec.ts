import { expect, test } from "@playwright/test";

import { ProjectDocumentsPage } from "../../pages/project-documents";
import {
  createCitizenProject,
  deleteTrackedProjects,
  demoFixture,
  mockStorageUpload,
  shortId,
} from "./project-helpers";

const PDF_FILE = "Jackson Creek - Scoping Letter.pdf";
const DOCX_FILE = "Jackson Creek - Draft Decision Memo.docx";

/**
 * The project Documents page: upload from the demo fixtures, rename, delete.
 * The browser's PUT to R2 is faked (see `mockStorageUpload`); presigning and
 * registering the document with the API are real.
 */
test.describe("Project documents", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("uploads a PDF, renames it and deletes it", async ({ page }) => {
    test.setTimeout(90000);

    const project = await createCitizenProject("Documents");
    const documentsPage = new ProjectDocumentsPage(page);
    await mockStorageUpload(page);

    await documentsPage.goto(project.path);
    await expect(
      documentsPage.main.getByRole("heading", { name: "No Documents Yet" }),
    ).toBeVisible();

    await documentsPage.upload(demoFixture(PDF_FILE));
    await expect(documentsPage.document(PDF_FILE)).toBeVisible();
    await page.reload();
    await expect(documentsPage.document(PDF_FILE)).toBeVisible({
      timeout: 15000,
    });

    // Rename: only the base name changes, the extension is kept.
    const renamedBase = `Scoping Letter ${shortId()}`;
    const renamedFile = `${renamedBase}.pdf`;
    await documentsPage.rename(PDF_FILE, renamedBase);
    await expect(documentsPage.document(renamedFile)).toBeVisible();
    await page.reload();
    await expect(documentsPage.document(renamedFile)).toBeVisible({
      timeout: 15000,
    });
    await expect(documentsPage.document(PDF_FILE)).toHaveCount(0);

    await documentsPage.delete(renamedFile);
    await page.reload();
    await expect(
      documentsPage.main.getByRole("heading", { name: "No Documents Yet" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(documentsPage.document(renamedFile)).toHaveCount(0);
  });

  test("an uploaded Word document is listed on the overview", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const project = await createCitizenProject("Documents Overview");
    const documentsPage = new ProjectDocumentsPage(page);
    await mockStorageUpload(page);

    await documentsPage.goto(project.path);
    await documentsPage.upload(demoFixture(DOCX_FILE));

    // The overview's Documents section card ("<name> DOCX · <source>"); the
    // timeline's upload entry names the file too, so match the card's type label.
    await page.goto(project.path);
    await expect(
      page.getByRole("main").getByRole("button", { name: `${DOCX_FILE} DOCX` }),
    ).toBeVisible({ timeout: 15000 });
  });
});
