import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import {
  office,
  organization,
  project,
  projectSubmission,
  projectUsers,
  user as userTable,
} from "@wildfires-org/turboplan-db/schemas";

import { getGovWorkspace } from "../../utils";

/**
 * Self-service registration tests.
 *
 * Drives the real `/self-service` page (which calls the
 * createUserWithOrganization server action) as an UNauthenticated new user, and
 * asserts the resulting DB state for the behavior change:
 *   - The project is ALWAYS created in the new user's PERSONAL org as a DRAFT
 *     that the creator owns. It is never auto-submitted at signup.
 *   - When BOTH organizationId + officeId (a government org/office) are passed,
 *     they are stored on the draft as the DEFAULT submit target
 *     (intendedSubmissionOrganizationId/intendedSubmissionOfficeId), but the
 *     project stays in the personal workspace and no projectSubmission row is
 *     created. Submission is a separate, explicit in-app step.
 *   - When absent, the project stays a private personal DRAFT with no intended
 *     submission target and no submission row.
 *
 * Runs unauthenticated (overrides the default citizen storage state). After the
 * action returns `email_sent` the page redirects to /check-email; the project is
 * created synchronously before the email, so we poll the DB for it.
 */

// Unauthenticated: the registration path only runs for users without a session.
test.use({ storageState: { cookies: [], origins: [] } });

const suffix = () => Math.random().toString(36).substring(2, 10);

/**
 * Submit the self-service form for a brand-new user and wait for the redirect to
 * /check-email (the `email_sent` outcome). Returns the email used.
 */
const registerViaForm = async (
  page: import("@playwright/test").Page,
  params: {
    projectName: string;
    organizationId?: string;
    officeId?: string;
  },
): Promise<string> => {
  const email = `self-service-${suffix()}@example.test`;

  const search = new URLSearchParams();
  if (params.organizationId) {
    search.set("organizationId", params.organizationId);
  }
  if (params.officeId) {
    search.set("officeId", params.officeId);
  }
  const query = search.toString();
  await page.goto(`/self-service${query ? `?${query}` : ""}`);

  await page.locator("#email").fill(email);
  await page.locator("#projectTitle").fill(params.projectName);

  // Email-existence check debounces; wait until the submit button is enabled and
  // not in the "Checking email..." state before submitting.
  await expect(page.getByText("Checking email...")).toHaveCount(0, {
    timeout: 10000,
  });

  await page.getByRole("button", { name: /create account|continue/i }).click();

  await page.waitForURL(/\/check-email/, { timeout: 20000 });

  return email;
};

/**
 * Poll the DB for the project created for `email` by the self-service action.
 */
const waitForCreatedProject = async (
  db: ReturnType<typeof createTestDB>["db"],
  email: string,
  projectName: string,
) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [createdUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email.toLowerCase()))
      .limit(1);

    if (createdUser) {
      const [createdProject] = await db
        .select()
        .from(project)
        .where(
          and(
            eq(project.name, projectName),
            eq(project.createdBy, createdUser.id),
          ),
        )
        .limit(1);

      if (createdProject) {
        return { createdUser, createdProject };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Project "${projectName}" for ${email} was not created within the timeout`,
  );
};

test.describe("Self-service registration", () => {
  // These tests drive the real registration form (debounced email check + submit),
  // send a magic-link email, then poll the DB for the synchronously-created
  // project. End-to-end that legitimately exceeds the default 30s budget when the
  // app/server are under load, so give them extra headroom.
  test.setTimeout(60_000);

  test("with a gov org + office: project is a personal DRAFT with the gov org/office stored as the default submit target (no auto-submission)", async ({
    page,
  }) => {
    const { db, close } = createTestDB();
    try {
      const govWorkspace = await getGovWorkspace();
      const [govOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, govWorkspace.orgSlug))
        .limit(1);

      const projectName = `Self Service Submit ${suffix()}`;
      const email = await registerViaForm(page, {
        projectName,
        organizationId: govOrg.id,
        officeId: govWorkspace.officeId,
      });

      const { createdUser, createdProject } = await waitForCreatedProject(
        db,
        email,
        projectName,
      );

      // The project is created as a private personal DRAFT and is NOT submitted
      // at signup. The selected gov org/office are stored only as the default
      // submit target the user can later act on explicitly.
      expect(createdProject.ownershipStatus).toBe("draft");
      expect(createdProject.isPublic).toBe(false);
      expect(createdProject.intendedSubmissionOrganizationId).toBe(govOrg.id);
      expect(createdProject.intendedSubmissionOfficeId).toBe(
        govWorkspace.officeId,
      );

      // The project stays in the user's PERSONAL workspace — it did NOT move into
      // the gov office.
      expect(createdProject.officeId).not.toBe(govWorkspace.officeId);
      const [parentOffice] = await db
        .select()
        .from(office)
        .where(eq(office.id, createdProject.officeId))
        .limit(1);
      const [parentOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, parentOffice.organizationId))
        .limit(1);
      expect(parentOrg.type).toBe("personal");
      expect(parentOrg.createdBy).toBe(createdUser.id);

      // The creator remains the OWNER (not downgraded to viewer).
      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, createdUser.id),
            eq(projectUsers.projectId, createdProject.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("owner");

      // No submission row was created at signup.
      const submissions = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, createdProject.id));
      expect(submissions.length).toBe(0);
    } finally {
      await close();
    }
  });

  test("without a gov org + office: project stays a private personal DRAFT (no submission row)", async ({
    page,
  }) => {
    const { db, close } = createTestDB();
    try {
      const projectName = `Self Service Draft ${suffix()}`;
      const email = await registerViaForm(page, { projectName });

      const { createdUser, createdProject } = await waitForCreatedProject(
        db,
        email,
        projectName,
      );

      // Stays a DRAFT, private, owned by the creator.
      expect(createdProject.ownershipStatus).toBe("draft");
      expect(createdProject.isPublic).toBe(false);

      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, createdUser.id),
            eq(projectUsers.projectId, createdProject.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("owner");

      // Lives in the user's PERSONAL org.
      const [parentOffice] = await db
        .select()
        .from(office)
        .where(eq(office.id, createdProject.officeId))
        .limit(1);
      const [parentOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, parentOffice.organizationId))
        .limit(1);
      expect(parentOrg.type).toBe("personal");
      expect(parentOrg.createdBy).toBe(createdUser.id);

      // No submission row.
      const submissions = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, createdProject.id));
      expect(submissions.length).toBe(0);
    } finally {
      await close();
    }
  });
});
