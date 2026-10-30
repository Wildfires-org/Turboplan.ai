import { expect, test } from "@playwright/test";

import { createToken } from "@wildfires-org/turboplan-api-client/server";
import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";
import { submitProjectForReview } from "@wildfires-org/turboplan-workspace/server";

import { appPaths } from "../../config";
import { getGovCredentials } from "../../config/test-credentials";
import { OfficeFeaturesSubmissionsPage } from "../../pages/office-features-submissions";
import {
  createTestProjectInOffice,
  getCitizenWorkspace,
  getGovWorkspace,
  getTestGovernmentOrganization,
  type WorkspaceInfo,
} from "../../utils";

/**
 * The office submission lists:
 * - `citizen-submissions` (gov reviewers) lists the projects submitted to the
 *   office that still live there (new + approved). A rejected submission
 *   reverts to the citizen's own office, so it leaves this list.
 * - `my-submissions` (the citizen) lists everything they submitted, whatever
 *   its review outcome, wherever it lives now.
 * A draft that was never submitted appears in neither.
 *
 * The submit/approve/reject flows themselves are covered in tests/citizen/*;
 * here they are seeded (server submit + review API) so the lists can be
 * checked. Both lists are shared with other specs and paginated, so every
 * assertion searches for this run's unique id first.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const RUN_ID = `subm${Math.random().toString(36).substring(2, 8)}`;
const DRAFT_NAME = `${RUN_ID} Culvert Draft`;
const SUBMITTED_NAME = `${RUN_ID} Bridge Proposal`;
const APPROVED_NAME = `${RUN_ID} Trail Proposal`;
const REJECTED_NAME = `${RUN_ID} Levee Proposal`;

const reviewSubmission = async (params: {
  projectId: string;
  reviewerToken: string;
  body: Record<string, unknown>;
}): Promise<void> => {
  const response = await fetch(
    `${SERVER_URL}/api/projects/${params.projectId}/review`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.reviewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Review of ${params.projectId} failed: ${response.status} ${await response.text()}`,
    );
  }
};

test.describe("Office submission lists", () => {
  test.setTimeout(60_000);

  let govWorkspace: WorkspaceInfo;
  let citizenWorkspace: WorkspaceInfo;

  test.beforeAll(async () => {
    govWorkspace = await getGovWorkspace();
    citizenWorkspace = await getCitizenWorkspace();

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
    const govToken = await createToken({ id: govUser.id });

    // Four citizen drafts in the citizen's personal office.
    const [, submitted, approved, rejected] = await Promise.all(
      [DRAFT_NAME, SUBMITTED_NAME, APPROVED_NAME, REJECTED_NAME].map((name) =>
        createTestProjectInOffice({
          name,
          description: "E2E submission list fixture",
          officeId: citizenWorkspace.officeId,
          createdBy: citizenWorkspace.userId,
        }),
      ),
    );

    // Submit three of them to the gov office (moves them there).
    for (const proposal of [submitted, approved, rejected]) {
      await submitProjectForReview({
        projectId: proposal.id,
        submittedBy: citizenWorkspace.userId,
        targetOrganizationId: govOrg.id,
        targetOfficeId: govWorkspace.officeId,
      });
    }

    await reviewSubmission({
      projectId: approved.id,
      reviewerToken: govToken,
      body: { action: "accepted" },
    });
    await reviewSubmission({
      projectId: rejected.id,
      reviewerToken: govToken,
      body: {
        action: "rejected",
        rejectionReason: "Outside this office's jurisdiction.",
      },
    });
  });

  test.describe("gov reviewer: citizen-submissions", () => {
    test.use({ storageState: "./storage/auth/gov.json" });

    test("lists new and approved submissions, not drafts or rejected ones", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoCitizenSubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      await submissions.search(RUN_ID);

      await submissions.expectSubmission(SUBMITTED_NAME, "New");
      await submissions.expectSubmission(APPROVED_NAME, "Approved");
      await expect(submissions.getSubmissionCards()).toHaveCount(2);
      await expect(submissions.getSubmissionCard(DRAFT_NAME)).toHaveCount(0);
      await expect(submissions.getSubmissionCard(REJECTED_NAME)).toHaveCount(0);

      // A card opens the project, which now lives in this (gov) office.
      await submissions.getSubmissionCard(SUBMITTED_NAME).click();
      await page.waitForURL(
        (url) => !url.pathname.endsWith("/citizen-submissions"),
      );
      expect(new URL(page.url()).pathname).toMatch(
        new RegExp(
          `^${appPaths.office(govWorkspace.orgSlug, govWorkspace.officeSlug)}/[^/]+$`,
        ),
      );
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        SUBMITTED_NAME,
      );
    });

    test("the status filter narrows the list to approved submissions", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoCitizenSubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      await submissions.search(RUN_ID);
      await expect(submissions.getSubmissionCards()).toHaveCount(2, {
        timeout: 15000,
      });

      await submissions.filterByStatus("Approved");

      await expect(submissions.getSubmissionCards()).toHaveCount(1);
      await submissions.expectSubmission(APPROVED_NAME, "Approved");
    });

    test("my-submissions redirects a gov user to the office page", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoMySubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );

      await page.waitForURL(
        new RegExp(
          `${appPaths.office(govWorkspace.orgSlug, govWorkspace.officeSlug)}$`,
        ),
      );
    });
  });

  test.describe("citizen: my-submissions", () => {
    test("lists every submission, wherever it lives now, but not drafts", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoMySubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      await submissions.search(RUN_ID);

      await submissions.expectSubmission(SUBMITTED_NAME, "New");
      await submissions.expectSubmission(APPROVED_NAME, "Approved");
      await expect(submissions.getSubmissionCard(REJECTED_NAME)).toBeVisible();
      await expect(submissions.getSubmissionCards()).toHaveCount(3);
      await expect(submissions.getSubmissionCard(DRAFT_NAME)).toHaveCount(0);

      // Cards link to each project's current office: the gov office while
      // under review or approved, the citizen's own office after a rejection.
      const govOfficePath = appPaths.office(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      const citizenOfficePath = appPaths.office(
        citizenWorkspace.orgSlug,
        citizenWorkspace.officeSlug,
      );
      await expect(
        submissions.getSubmissionCard(SUBMITTED_NAME),
      ).toHaveAttribute("href", new RegExp(`^${govOfficePath}/`));
      await expect(
        submissions.getSubmissionCard(REJECTED_NAME),
      ).toHaveAttribute("href", new RegExp(`^${citizenOfficePath}/`));
    });

    test("the status filter narrows the list to new submissions", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoMySubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      await submissions.search(RUN_ID);
      await expect(submissions.getSubmissionCards()).toHaveCount(3, {
        timeout: 15000,
      });

      await submissions.filterByStatus("New");

      await expect(submissions.getSubmissionCards()).toHaveCount(1);
      await submissions.expectSubmission(SUBMITTED_NAME, "New");
    });

    test("labels a rejected submission as Rejected", async ({ page }) => {
      // Rejecting resets the project to draft so it can be resubmitted; the
      // list must report the review outcome, not the project's status.
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoMySubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );
      await submissions.search(RUN_ID);
      await expect(submissions.getSubmissionCards()).toHaveCount(3, {
        timeout: 15000,
      });

      await submissions.filterByStatus("Rejected");

      await expect(submissions.getSubmissionCards()).toHaveCount(1);
      await submissions.expectSubmission(REJECTED_NAME, "Rejected");
    });

    test("citizen-submissions redirects a citizen to the office page", async ({
      page,
    }) => {
      const submissions = new OfficeFeaturesSubmissionsPage(page);
      await submissions.gotoCitizenSubmissions(
        govWorkspace.orgSlug,
        govWorkspace.officeSlug,
      );

      await page.waitForURL(
        new RegExp(
          `${appPaths.office(govWorkspace.orgSlug, govWorkspace.officeSlug)}$`,
        ),
      );
    });
  });
});
