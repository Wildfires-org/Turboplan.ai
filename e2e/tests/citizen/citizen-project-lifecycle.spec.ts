import { expect, test } from "@playwright/test";

import { GOV_WORKSPACE } from "../../config/test-data";
import {
  TurboplanCitizenSidebarPage,
  TurboplanDashboardPage,
  TurboplanProjectPage,
} from "../../pages";
import { getGovWorkspace } from "../../utils";

/**
 * Citizen Project Lifecycle tests.
 *
 * Verifies the full lifecycle of a citizen-owned project:
 * 1. Citizen creates a new project (application) in the gov office
 * 2. Citizen can edit the project while it is a draft
 * 3. Citizen submits the application to the gov organization
 * 4. After submission, the project shows a "Submitted" badge
 * 5. After submission, the "Submit Application" button is gone
 * 6. After submission, the project dropdown menu is hidden (no edit)
 *
 * Default auth is citizen (storageState from playwright config).
 * Uses serial execution because each step depends on the previous state.
 */

const DRAFT_PROJECT_NAME = `Citizen Draft ${Date.now()}`;
const DRAFT_PROJECT_DESCRIPTION =
  "We're proposing a community park restoration project at Riverside Park in downtown Portland, Oregon. The park currently has degraded trails, invasive plant species along the riverbank, and outdated playground equipment. Our goal is to restore native vegetation, rebuild accessible walking paths, and install modern play structures for families.";

let govOrgSlug: string;
let govOfficeSlug: string;

test.describe
  .serial("Citizen Project Lifecycle", () => {
    // Serial multi-step lifecycle (create → edit → submit → navigate); the full
    // flow can exceed the default 30s under parallel load.
    test.setTimeout(60_000);

    test.beforeAll(async () => {
      const govWorkspace = await getGovWorkspace();
      govOrgSlug = govWorkspace.orgSlug;
      govOfficeSlug = govWorkspace.officeSlug;
    });

    test("citizen can create a new project in the gov office", async ({
      page,
    }) => {
      const dashboard = new TurboplanDashboardPage(page);
      const sidebar = new TurboplanCitizenSidebarPage(page);
      const project = new TurboplanProjectPage(page);

      await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);
      await dashboard.expectOfficeHeading(GOV_WORKSPACE.OFFICE_NAME);

      await sidebar.createProject(
        DRAFT_PROJECT_NAME,
        DRAFT_PROJECT_DESCRIPTION,
        GOV_WORKSPACE.OFFICE_NAME,
      );

      // Verify the project name is displayed in the breadcrumb
      await project.expectBreadcrumbLink(DRAFT_PROJECT_NAME);

      // Navigate to project overview to verify draft controls
      await project.goToOverview();

      // Verify the "Submit Application" button is visible (project is a draft)
      await project.expectSubmitButton();
    });

    test("citizen can see the draft project in the sidebar", async ({
      page,
    }) => {
      const dashboard = new TurboplanDashboardPage(page);
      const sidebar = new TurboplanCitizenSidebarPage(page);

      await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);
      await dashboard.expectOfficeHeading(GOV_WORKSPACE.OFFICE_NAME);

      await sidebar.expectMyDraftsVisible();
      await sidebar.expectProjectVisible(DRAFT_PROJECT_NAME);
    });

    test("citizen can submit the project application", async ({ page }) => {
      const dashboard = new TurboplanDashboardPage(page);
      const sidebar = new TurboplanCitizenSidebarPage(page);
      const project = new TurboplanProjectPage(page);

      await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);
      await dashboard.expectOfficeHeading(GOV_WORKSPACE.OFFICE_NAME);

      await sidebar.clickProject(DRAFT_PROJECT_NAME);

      await project.openSubmitDialog();
      await project.expectTransferWarning();
      await project.expectDialogOfficeName(GOV_WORKSPACE.OFFICE_NAME);
      await project.confirmAndSubmit();

      // After submission the dialog revalidates caches and redirects the citizen
      // away from the project page (the project now belongs to the gov office and
      // the citizen is only a viewer). Re-open the project from the "Submitted"
      // sidebar section — its canonical post-submission location — instead of
      // reloading the stale page, then assert the submitted state.
      await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);
      await dashboard.expectOfficeHeading(GOV_WORKSPACE.OFFICE_NAME);

      await sidebar.expectSubmittedSectionVisible();
      await sidebar.clickProject(DRAFT_PROJECT_NAME);

      await project.expectSubmittedBadge();
    });

    test("submitted project shows 'Submitted' badge and no edit controls", async ({
      page,
    }) => {
      const dashboard = new TurboplanDashboardPage(page);
      const sidebar = new TurboplanCitizenSidebarPage(page);
      const project = new TurboplanProjectPage(page);

      await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);
      await dashboard.expectOfficeHeading(GOV_WORKSPACE.OFFICE_NAME);

      await sidebar.expectSubmittedSectionVisible();
      await sidebar.clickProject(DRAFT_PROJECT_NAME);

      await project.expectHeading(DRAFT_PROJECT_NAME);
      await project.expectSubmittedBadge();
      await project.expectNoSubmitButton();
      await project.expectNoDropdownMenu();
    });
  });
