import { expect, test } from "@playwright/test";

import { ProjectContextPage } from "../../pages/project-context";
import { ProjectDocumentsPage } from "../../pages/project-documents";
import {
  createCitizenProject,
  deleteTrackedProjects,
  demoFixture,
  isModuleEnabled,
  mockStorageUpload,
} from "./project-helpers";

const PDF_FILE = "Jackson Creek - Botany Survey Interim Report.pdf";

const isProjectContextEnabled = isModuleEnabled(
  "IS_PROJECT_CONTEXT_PACKAGE_ENABLED",
);

/**
 * The project Context page (`/context`). Its dropzone and GIS layers belong to
 * the documents and map modules; "Notes and references" belongs to the
 * project-context module, which is off in the default E2E `.env`. GIS drops
 * are covered in project-map.spec.ts.
 */
test.describe("Project context", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("a PDF dropped on the context page is added to the project documents", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const project = await createCitizenProject("Context Upload");
    await mockStorageUpload(page);

    const contextPage = new ProjectContextPage(page);
    await contextPage.goto(project.path);
    await contextPage.dropFile(demoFixture(PDF_FILE));
    // The status row appears at once; leaving before it reports the document
    // as added would abort the upload.
    await expect(
      contextPage.main.getByRole("listitem").filter({ hasText: PDF_FILE }),
    ).toContainText("Added to documents", { timeout: 30000 });

    // Stored as a project document: listed on a fresh Documents page.
    const documentsPage = new ProjectDocumentsPage(page);
    await documentsPage.goto(project.path);
    await expect(documentsPage.document(PDF_FILE)).toBeVisible({
      timeout: 15000,
    });

    // And still listed on the Context page after a reload.
    await contextPage.goto(project.path);
    await expect(contextPage.main.getByText(PDF_FILE).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("hides the notes section when the project-context module is off", async ({
    page,
  }) => {
    test.skip(
      isProjectContextEnabled,
      "Only meaningful with IS_PROJECT_CONTEXT_PACKAGE_ENABLED=false",
    );
    // Notes belong to the project-context package, whose API is only mounted
    // when it is on, so the section is hidden rather than failing to load.
    const project = await createCitizenProject("Context Notes Off");
    const contextPage = new ProjectContextPage(page);
    await contextPage.goto(project.path);

    // The notes heading is static, so it would be up by the time the dropzone
    // is; empty documents and GIS panels render nothing to wait for.
    await expect(
      contextPage.main.getByRole("button", { name: "Browse files" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(contextPage.notesHeading).toHaveCount(0);
    await expect(
      contextPage.main.getByText("Failed to load context entries."),
    ).toBeHidden();
  });
});
