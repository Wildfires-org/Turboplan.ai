import { expect, test } from "@playwright/test";

import {
  createOffice,
  getOfficeById,
} from "@wildfires-org/turboplan-workspace/server";

import { TurboplanOfficeSettingsDialog } from "../../pages";
import {
  getCitizenWorkspace,
  getTestUserOrganization,
  type WorkspaceInfo,
} from "../../utils";

const shortId = (): string => Math.random().toString(36).substring(2, 8);

// Navy swatch (#1e3a8a) as a computed CSS color.
const NAVY_RGB = "rgb(30, 58, 138)";

/**
 * Office letterhead + document details in the Manage Office dialog.
 *
 * Runs as the citizen user, who owns their personal organization and so may
 * update any office in it. The spec creates its own office so the letterhead
 * and document details it saves never reach other specs' documents.
 */
test.describe("Office letterhead and document details", () => {
  let workspace: WorkspaceInfo;
  let officeId: string;
  let officeSlug: string;

  test.beforeAll(async () => {
    workspace = await getCitizenWorkspace();
    const organization = await getTestUserOrganization(workspace.userId);
    if (!organization) {
      throw new Error("Citizen organization not found");
    }
    const office = await createOffice({
      name: `Letterhead Office ${shortId()}`,
      organizationId: organization.id,
      createdBy: workspace.userId,
    });
    officeId = office.id;
    officeSlug = office.slug;
  });

  test("saves the letterhead and document details and shows them on reopen", async ({
    page,
  }) => {
    const nameLines = ["Department of Testing", "Quality District"];
    const contactLines = ["1 Test Plaza", "Testville, CA 90000"];
    const details = {
      "Signatory name": "Jane Reviewer",
      "Signatory title": "District Ranger",
      "Contact person": "John Contact",
      "Contact email": "comments@example.test",
      "Contact phone": "(555) 555-0100",
      "Office hours": "Mon-Fri, 8:00 a.m.-4:30 p.m.",
      "Default file code": "1950",
      "Other facts": "Comment period: 30 days",
    } as const;

    const settings = new TurboplanOfficeSettingsDialog(page);
    await settings.openFromOffice(workspace.orgSlug, officeSlug);
    const { letterhead } = settings;

    // Nothing configured yet: the preview asks for name lines.
    await expect(letterhead.preview).toContainText(
      "Add organization lines to preview the letterhead.",
    );

    await letterhead.selectLayout("Logo left");
    await expect(letterhead.layoutOption("Logo left")).toBeChecked();
    await letterhead.linesInput.fill(nameLines.join("\n"));
    await letterhead.contactInput.fill(contactLines.join("\n"));
    await letterhead.selectColor("Navy");
    await expect(letterhead.colorOption("Navy")).toBeChecked();

    // The live preview renders the lines in the brand color.
    const previewBand = letterhead.preview.getByTestId("letterhead-band");
    await expect(previewBand).toBeVisible();
    for (const line of [...nameLines, ...contactLines]) {
      await expect(previewBand.getByText(line, { exact: true })).toBeVisible();
    }
    await expect(
      previewBand.getByText(nameLines[0], { exact: true }),
    ).toHaveCSS("color", NAVY_RGB);

    for (const [label, value] of Object.entries(details)) {
      await settings.documentDetail(label as keyof typeof details).fill(value);
    }

    await settings.save();

    // "Logo left" is also the form default for an unconfigured office, so
    // check the stored row too, not just the reopened form.
    const saved = await getOfficeById(officeId);
    expect(saved?.documentLetterheadLayout).toBe("split");
    expect(saved?.documentLetterheadColor).toBe("#1e3a8a");
    expect(saved?.documentLetterheadLines).toBe(nameLines.join("\n"));
    expect(saved?.documentProfile).toMatchObject({
      signatoryName: details["Signatory name"],
      contactEmail: details["Contact email"],
      facts: details["Other facts"],
    });

    // A fresh page load seeds the dialog from the saved office.
    await settings.openFromOffice(workspace.orgSlug, officeSlug);

    await expect(letterhead.layoutOption("Logo left")).toBeChecked();
    await expect(letterhead.colorOption("Navy")).toBeChecked();
    await expect(letterhead.linesInput).toHaveValue(nameLines.join("\n"));
    await expect(letterhead.contactInput).toHaveValue(contactLines.join("\n"));
    for (const [label, value] of Object.entries(details)) {
      await expect(
        settings.documentDetail(label as keyof typeof details),
      ).toHaveValue(value);
    }
    await expect(
      letterhead.preview.getByText(nameLines[1], { exact: true }),
    ).toBeVisible();
  });
});
