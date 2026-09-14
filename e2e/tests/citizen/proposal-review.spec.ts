import { expect, test } from "@playwright/test";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import {
  getCitizenCredentials,
  getGovCredentials,
} from "../../config/test-credentials";
import { TurboplanDashboardPage, TurboplanProjectPage } from "../../pages";
import {
  createTestProjectInOffice,
  getEtherealCredentials,
  getGovWorkspace,
  getTestGovernmentOrganization,
  waitForEmail,
} from "../../utils";

/**
 * Proposal Review tests.
 *
 * Verifies the government official's ability to approve and reject
 * citizen-submitted proposals, including:
 * 1. Gov user sees a review banner on submitted projects
 * 2. Gov user can approve a proposal (banner disappears)
 * 3. Citizen receives an acceptance email after approval
 * 4. Gov user can reject a proposal with a reason (banner disappears)
 * 5. Citizen receives a rejection email with the reason
 *
 * Uses serial execution because the approval/rejection flows
 * depend on projects created in beforeAll.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const APPROVE_PROJECT_NAME = `Approve Test ${Date.now()}`;
const REJECT_PROJECT_NAME = `Reject Test ${Date.now()}`;
const REJECTION_REASON =
  "The proposal does not meet safety requirements for this area.";

let govOrgSlug: string;
let govOfficeSlug: string;
let approveProjectSlug: string;
let rejectProjectSlug: string;
let citizenEmail: string;

const etherealCredentials = getEtherealCredentials();

test.describe
  .serial("Proposal Review", () => {
    test.beforeAll(async () => {
      // Resolve gov workspace
      const govWorkspace = await getGovWorkspace();
      govOrgSlug = govWorkspace.orgSlug;
      govOfficeSlug = govWorkspace.officeSlug;

      // Resolve citizen user
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      citizenEmail = citizenCreds.email;

      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found in database");
      }

      // Resolve gov org for submission target
      const govCreds = getGovCredentials();
      if (!govCreds) {
        throw new Error("Gov credentials not found");
      }
      const govUser = await getUserByEmail(govCreds.email);
      if (!govUser) {
        throw new Error("Gov user not found in database");
      }
      const govOrg = await getTestGovernmentOrganization(govUser.id);
      if (!govOrg) {
        throw new Error("Gov organization not found");
      }

      // Create citizen auth token for API calls
      const citizenToken = await createToken({ id: citizenUser.id });

      // Create two citizen-owned projects in the gov office
      const approveProject = await createTestProjectInOffice({
        name: APPROVE_PROJECT_NAME,
        description: "E2E test - project to be approved",
        officeId: govWorkspace.officeId,
        createdBy: citizenUser.id,
      });
      approveProjectSlug = approveProject.slug;

      const rejectProject = await createTestProjectInOffice({
        name: REJECT_PROJECT_NAME,
        description: "E2E test - project to be rejected",
        officeId: govWorkspace.officeId,
        createdBy: citizenUser.id,
      });
      rejectProjectSlug = rejectProject.slug;

      // Submit both projects via the real API endpoint
      for (const proj of [approveProject, rejectProject]) {
        const response = await fetch(
          `${SERVER_URL}/api/projects/${proj.id}/submit`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${citizenToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              targetOrganizationId: govOrg.id,
              targetOfficeId: govWorkspace.officeId,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(
            `Failed to submit project ${proj.name}: ${response.status} ${error}`,
          );
        }
      }
    });

    test("gov user sees review banner on submitted project", async ({
      browser,
    }) => {
      const govContext = await browser.newContext({
        storageState: "./storage/auth/gov.json",
      });
      const govPage = await govContext.newPage();
      const dashboard = new TurboplanDashboardPage(govPage);
      const projectPage = new TurboplanProjectPage(govPage);

      await dashboard.gotoProject(
        govOrgSlug,
        govOfficeSlug,
        approveProjectSlug,
      );
      await projectPage.expectReviewBanner();

      await govContext.close();
    });

    test("gov user can approve a proposal", async ({ browser }) => {
      const govContext = await browser.newContext({
        storageState: "./storage/auth/gov.json",
      });
      const govPage = await govContext.newPage();
      const dashboard = new TurboplanDashboardPage(govPage);
      const projectPage = new TurboplanProjectPage(govPage);

      await dashboard.gotoProject(
        govOrgSlug,
        govOfficeSlug,
        approveProjectSlug,
      );
      await projectPage.expectReviewBanner();
      await projectPage.openApproveDialog();
      await projectPage.confirmApproval();

      // Wait for page to reflect the approval
      await govPage.waitForTimeout(1000);
      await projectPage.expectNoReviewBanner();

      await govContext.close();
    });

    test("citizen receives acceptance email after approval", async () => {
      test.skip(
        !etherealCredentials,
        "ETHEREAL_USER and ETHEREAL_PASS not set - skipping email tests",
      );

      const email = await waitForEmail(etherealCredentials!, {
        to: citizenEmail,
        subject: "approved",
        timeout: 30000,
        pollInterval: 2000,
        sinceMinutes: 5,
      });

      expect(
        email,
        `No acceptance email received for ${citizenEmail}`,
      ).not.toBeNull();
      expect(email!.to.toLowerCase()).toBe(citizenEmail.toLowerCase());
      expect(email!.subject.toLowerCase()).toContain("approved");

      if (email!.html) {
        expect(email!.html).toContain(APPROVE_PROJECT_NAME);
      }
    });

    test("gov user can reject a proposal with reason", async ({ browser }) => {
      const govContext = await browser.newContext({
        storageState: "./storage/auth/gov.json",
      });
      const govPage = await govContext.newPage();
      const dashboard = new TurboplanDashboardPage(govPage);
      const projectPage = new TurboplanProjectPage(govPage);

      await dashboard.gotoProject(govOrgSlug, govOfficeSlug, rejectProjectSlug);
      await projectPage.expectReviewBanner();
      await projectPage.openRejectDialog();
      await projectPage.confirmRejection(REJECTION_REASON);

      // Wait for page to reflect the rejection
      await govPage.waitForTimeout(1000);
      await projectPage.expectNoReviewBanner();

      await govContext.close();
    });

    test("citizen receives rejection email with reason", async () => {
      test.skip(
        !etherealCredentials,
        "ETHEREAL_USER and ETHEREAL_PASS not set - skipping email tests",
      );

      const email = await waitForEmail(etherealCredentials!, {
        to: citizenEmail,
        subject: "submission",
        timeout: 30000,
        pollInterval: 2000,
        sinceMinutes: 5,
      });

      expect(
        email,
        `No rejection email received for ${citizenEmail}`,
      ).not.toBeNull();
      expect(email!.to.toLowerCase()).toBe(citizenEmail.toLowerCase());

      if (email!.html) {
        expect(email!.html).toContain(REJECT_PROJECT_NAME);
        expect(email!.html).toContain(REJECTION_REASON);
      }
    });
  });
