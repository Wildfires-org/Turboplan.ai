import { expect, test } from "@playwright/test";

import { TurboplanOrgSettingsDialog } from "../../pages";
import {
  deleteLibraryLetterheadsByPrefix,
  getGovWorkspace,
  getTestGovernmentOrganization,
} from "../../utils";

const NAME_PREFIX = "E2E Library";

const shortId = (): string => Math.random().toString(36).substring(2, 8);

/**
 * Manage Organization → Letterheads: add, rename and delete a library
 * letterhead through the UI.
 *
 * Runs as the government user, who owns the GOVERNMENT organization created in
 * auth-gov.setup.ts (the dialog is only offered to users who may update it).
 */
test.use({ storageState: "./storage/auth/gov.json" });

test.describe("Organization letterhead library", () => {
  let orgSlug: string;
  let organizationId: string;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    orgSlug = gov.orgSlug;
    const organization = await getTestGovernmentOrganization(gov.userId);
    if (!organization) {
      throw new Error("Gov organization not found");
    }
    organizationId = organization.id;
  });

  // Each test removes the letterheads it created (all named after its unique
  // name), so a failed run leaves nothing behind in the shared gov org.
  const cleanUp = (name: string) =>
    deleteLibraryLetterheadsByPrefix(organizationId, name);

  test("adds, renames and deletes a letterhead", async ({ page }) => {
    const name = `${NAME_PREFIX} ${shortId()}`;
    const renamed = `${name} renamed`;
    const nameLines = ["Partner Agency", "Partner Unit"];

    try {
      const settings = new TurboplanOrgSettingsDialog(page);
      await settings.openFromOrg(orgSlug);
      await settings.switchTo("Letterheads");

      // ── Add ──────────────────────────────────────────────────────────
      await settings.addLetterheadButton.click();
      const add = settings.libraryLetterheadDialog("Add letterhead");
      await expect(add.dialog).toBeVisible();
      await add.nameInput.fill(name);
      await add.editor.selectLayout("Centered");
      await add.editor.linesInput.fill(nameLines.join("\n"));
      await add.editor.selectColor("Rust");
      await expect(
        add.editor.preview.getByText(nameLines[0], { exact: true }),
      ).toBeVisible();
      await add.dialog.getByRole("button", { name: "Add letterhead" }).click();

      await expect(page.getByText("Letterhead added.")).toBeVisible();
      await expect(add.dialog).toBeHidden();
      await expect(settings.letterheadRow(name)).toBeVisible();

      // ── Edit: the form is seeded from the saved letterhead ───────────
      await settings.editLetterheadButton(name).click();
      const edit = settings.libraryLetterheadDialog("Edit letterhead");
      await expect(edit.dialog).toBeVisible();
      await expect(edit.nameInput).toHaveValue(name);
      await expect(edit.editor.layoutOption("Centered")).toBeChecked();
      await expect(edit.editor.colorOption("Rust")).toBeChecked();
      await expect(edit.editor.linesInput).toHaveValue(nameLines.join("\n"));

      await edit.nameInput.fill(renamed);
      await edit.dialog
        .getByRole("button", { name: "Save letterhead" })
        .click();

      await expect(page.getByText("Letterhead updated.")).toBeVisible();
      await expect(edit.dialog).toBeHidden();
      await expect(settings.letterheadRow(renamed)).toBeVisible();
      await expect(settings.letterheadRow(name)).toHaveCount(0);

      // ── Delete (with confirmation) ───────────────────────────────────
      await settings.deleteLetterheadButton(renamed).click();
      await expect(settings.deleteLetterheadConfirm).toBeVisible();
      await expect(settings.deleteLetterheadConfirm).toContainText(renamed);
      await settings.deleteLetterheadConfirm
        .getByRole("button", { name: "Delete" })
        .click();

      await expect(page.getByText("Letterhead deleted.")).toBeVisible();
      await expect(settings.deleteLetterheadConfirm).toBeHidden();
      await expect(settings.letterheadRow(renamed)).toHaveCount(0);
    } finally {
      await cleanUp(name);
    }
  });

  test("cancelling the delete confirmation keeps the letterhead", async ({
    page,
  }) => {
    const name = `${NAME_PREFIX} ${shortId()}`;

    try {
      const settings = new TurboplanOrgSettingsDialog(page);
      await settings.openFromOrg(orgSlug);
      await settings.switchTo("Letterheads");

      await settings.addLetterheadButton.click();
      const add = settings.libraryLetterheadDialog("Add letterhead");
      await add.nameInput.fill(name);
      await add.editor.linesInput.fill("Kept Agency");
      await add.dialog.getByRole("button", { name: "Add letterhead" }).click();
      await expect(settings.letterheadRow(name)).toBeVisible();

      await settings.deleteLetterheadButton(name).click();
      await settings.deleteLetterheadConfirm
        .getByRole("button", { name: "Cancel" })
        .click();

      await expect(settings.deleteLetterheadConfirm).toBeHidden();
      await expect(settings.letterheadRow(name)).toBeVisible();
    } finally {
      await cleanUp(name);
    }
  });
});
