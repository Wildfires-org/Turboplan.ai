import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";
import {
  office,
  organization,
  project,
  projectSubmission,
  projectUsers,
} from "@wildfires-org/turboplan-db/schemas";
import { submitProjectForReview } from "@wildfires-org/turboplan-workspace/server";

import {
  getCitizenCredentials,
  getGovCredentials,
} from "../../config/test-credentials";
import { getGovWorkspace } from "../../utils";

/**
 * create-from-template route tests.
 *
 * POST /api/projects/:id/create-from-template now has two modes and returns
 * `{ project, submitted, location: { organizationSlug, officeSlug, projectSlug } }`:
 *   - PERSONAL mode (no slugs, optional submitTo): create in the caller's personal
 *     org as a DRAFT they own; submitTo only saves the gov office as the default
 *     submit target for a later explicit submit-for-review (nothing is submitted now).
 *   - DIRECT mode (organizationSlug + officeSlug): create straight into that office
 *     (requires CREATE), submitted=false.
 *
 * Validation: partial slugs -> 400; both slugs + submitTo -> 400.
 *
 * Also covers the reject-revert regression: rejecting a submission reverts the
 * project to the citizen's source office and restores them to owner.
 *
 * Runs in the `api` project (no browser). Hits the real Hono server over HTTP.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

const suffix = () => Math.random().toString(36).substring(2, 10);

/**
 * Seed a PUBLIC template project owned by `ownerId` in a fresh org/office.
 * Public so READ access is not required, and gov-staff direct mode can use it.
 */
const seedTemplate = async (
  db: ReturnType<typeof createTestDB>["db"],
  ownerId: string,
) => {
  const now = new Date();
  const sfx = suffix();

  const [templateOrg] = await db
    .insert(organization)
    .values({
      slug: `tpl-org-${sfx}`,
      name: "Template org",
      type: "business",
      status: "active",
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [templateOffice] = await db
    .insert(office)
    .values({
      name: "Template office",
      slug: `tpl-office-${sfx}`,
      organizationId: templateOrg.id,
      createdBy: ownerId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [templateProject] = await db
    .insert(project)
    .values({
      name: `Template ${sfx}`,
      slug: `tpl-project-${sfx}`,
      description: "seed template",
      officeId: templateOffice.id,
      createdBy: ownerId,
      lastModifiedBy: ownerId,
      status: "active",
      isTemplate: true,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return templateProject;
};

const createFromTemplate = (
  templateId: string,
  token: string,
  body: Record<string, unknown>,
) =>
  fetch(`${SERVER_URL}/api/projects/${templateId}/create-from-template`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

test.describe("create-from-template route", () => {
  test("PERSONAL mode (no submitTo): creates a DRAFT the citizen owns in their personal org", async () => {
    const { db, close } = createTestDB();
    try {
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found");
      }
      const citizenToken = await createToken({ id: citizenUser.id });

      const template = await seedTemplate(db, citizenUser.id);

      const response = await createFromTemplate(template.id, citizenToken, {
        name: `Personal Draft ${suffix()}`,
      });

      expect(response.status, await response.clone().text()).toBe(201);
      const payload = (await response.json()) as {
        project: { id: string; slug: string; ownershipStatus: string };
        submitted: boolean;
        location: {
          organizationSlug: string;
          officeSlug: string;
          projectSlug: string;
        };
      };

      expect(payload.submitted).toBe(false);
      expect(payload.project.ownershipStatus).toBe("draft");
      expect(payload.location.projectSlug).toBe(payload.project.slug);

      // The new project lives in a personal org the citizen created and owns.
      const [createdProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, payload.project.id))
        .limit(1);
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
      expect(parentOrg.createdBy).toBe(citizenUser.id);
      expect(payload.location.organizationSlug).toBe(parentOrg.slug);

      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, citizenUser.id),
            eq(projectUsers.projectId, payload.project.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("owner");

      // No submission row exists for a non-submitted draft.
      const submissions = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, payload.project.id));
      expect(submissions.length).toBe(0);
    } finally {
      await close();
    }
  });

  test("PERSONAL mode (with submitTo): saves the gov office as the intended submit target but stays a personal DRAFT (submitted=false)", async () => {
    const { db, close } = createTestDB();
    try {
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found");
      }
      const citizenToken = await createToken({ id: citizenUser.id });

      const govWorkspace = await getGovWorkspace();
      const [govOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, govWorkspace.orgSlug))
        .limit(1);

      const template = await seedTemplate(db, citizenUser.id);

      const response = await createFromTemplate(template.id, citizenToken, {
        name: `Submitted Draft ${suffix()}`,
        submitTo: {
          organizationId: govOrg.id,
          officeId: govWorkspace.officeId,
        },
      });

      expect(response.status, await response.clone().text()).toBe(201);
      const payload = (await response.json()) as {
        project: { id: string; slug: string; ownershipStatus: string };
        submitted: boolean;
        location: {
          organizationSlug: string;
          officeSlug: string;
          projectSlug: string;
        };
      };

      // submitTo is only a saved default target — nothing is submitted at creation.
      expect(payload.submitted).toBe(false);
      expect(payload.project.ownershipStatus).toBe("draft");
      expect(payload.location.projectSlug).toBe(payload.project.slug);
      // Location stays in the citizen's personal workspace, not the gov office.
      expect(payload.location.officeSlug).not.toBe(govWorkspace.officeSlug);

      // Project stays in the personal workspace as a DRAFT, with the gov office
      // saved as the intended submission target.
      const [createdProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, payload.project.id))
        .limit(1);
      expect(createdProject.officeId).not.toBe(govWorkspace.officeId);
      expect(createdProject.ownershipStatus).toBe("draft");
      expect(createdProject.intendedSubmissionOrganizationId).toBe(govOrg.id);
      expect(createdProject.intendedSubmissionOfficeId).toBe(
        govWorkspace.officeId,
      );

      // No submission row is created at this stage.
      const submissions = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, payload.project.id));
      expect(submissions).toHaveLength(0);

      // Creator owns the personal draft (not downgraded to viewer).
      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, citizenUser.id),
            eq(projectUsers.projectId, payload.project.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("owner");
    } finally {
      await close();
    }
  });

  test("DIRECT mode: creates straight into the given office with submitted=false", async () => {
    const { db, close } = createTestDB();
    try {
      const govWorkspace = await getGovWorkspace();
      const govCreds = getGovCredentials();
      if (!govCreds) {
        throw new Error("Gov credentials not found");
      }
      const govUser = await getUserByEmail(govCreds.email);
      if (!govUser) {
        throw new Error("Gov user not found");
      }
      const govToken = await createToken({ id: govUser.id });

      // Gov staff owns the gov office, so they hold CREATE on it.
      const template = await seedTemplate(db, govUser.id);

      const response = await createFromTemplate(template.id, govToken, {
        name: `Direct Project ${suffix()}`,
        organizationSlug: govWorkspace.orgSlug,
        officeSlug: govWorkspace.officeSlug,
      });

      expect(response.status, await response.clone().text()).toBe(201);
      const payload = (await response.json()) as {
        project: { id: string; slug: string };
        submitted: boolean;
        location: {
          organizationSlug: string;
          officeSlug: string;
          projectSlug: string;
        };
      };

      expect(payload.submitted).toBe(false);
      expect(payload.location.organizationSlug).toBe(govWorkspace.orgSlug);
      expect(payload.location.officeSlug).toBe(govWorkspace.officeSlug);

      // Project created directly in the gov office (no personal org indirection).
      const [createdProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, payload.project.id))
        .limit(1);
      expect(createdProject.officeId).toBe(govWorkspace.officeId);

      // No submission row in direct mode.
      const submissions = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, payload.project.id));
      expect(submissions.length).toBe(0);
    } finally {
      await close();
    }
  });

  test("validation: a single slug (officeSlug without organizationSlug) -> 400", async () => {
    const { db, close } = createTestDB();
    try {
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found");
      }
      const citizenToken = await createToken({ id: citizenUser.id });

      const template = await seedTemplate(db, citizenUser.id);

      const response = await createFromTemplate(template.id, citizenToken, {
        officeSlug: "some-office",
      });

      expect(response.status).toBe(400);
    } finally {
      await close();
    }
  });

  test("validation: both slugs + submitTo -> 400", async () => {
    const { db, close } = createTestDB();
    try {
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found");
      }
      const citizenToken = await createToken({ id: citizenUser.id });

      const govWorkspace = await getGovWorkspace();
      const [govOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, govWorkspace.orgSlug))
        .limit(1);

      const template = await seedTemplate(db, citizenUser.id);

      const response = await createFromTemplate(template.id, citizenToken, {
        organizationSlug: govWorkspace.orgSlug,
        officeSlug: govWorkspace.officeSlug,
        submitTo: {
          organizationId: govOrg.id,
          officeId: govWorkspace.officeId,
        },
      });

      expect(response.status).toBe(400);
    } finally {
      await close();
    }
  });
});

test.describe("submission reject-revert regression", () => {
  test("rejecting a submission reverts the project to the source office and restores the submitter to owner", async () => {
    const { db, close } = createTestDB();
    try {
      const citizenCreds = getCitizenCredentials();
      if (!citizenCreds) {
        throw new Error("Citizen credentials not found");
      }
      const citizenUser = await getUserByEmail(citizenCreds.email);
      if (!citizenUser) {
        throw new Error("Citizen user not found");
      }
      const citizenToken = await createToken({ id: citizenUser.id });

      const govWorkspace = await getGovWorkspace();
      const govCreds = getGovCredentials();
      if (!govCreds) {
        throw new Error("Gov credentials not found");
      }
      const govUser = await getUserByEmail(govCreds.email);
      if (!govUser) {
        throw new Error("Gov user not found");
      }
      const govToken = await createToken({ id: govUser.id });
      const [govOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, govWorkspace.orgSlug))
        .limit(1);

      // 1. Create a personal DRAFT, then explicitly submit it for review.
      const template = await seedTemplate(db, citizenUser.id);
      const createResponse = await createFromTemplate(
        template.id,
        citizenToken,
        {
          name: `Revert Regression ${suffix()}`,
        },
      );
      expect(createResponse.status, await createResponse.clone().text()).toBe(
        201,
      );
      const { project: createdProject } = (await createResponse.json()) as {
        project: { id: string };
      };

      // Submit to the gov office via the shared submit flow, capturing the
      // source office the project should revert to on rejection.
      const { submission } = await submitProjectForReview({
        projectId: createdProject.id,
        submittedBy: citizenUser.id,
        targetOrganizationId: govOrg.id,
        targetOfficeId: govWorkspace.officeId,
      });
      const sourceOfficeId = submission.sourceOfficeId;
      expect(sourceOfficeId).toBeTruthy();

      // 2. Gov user rejects the submission.
      const rejectResponse = await fetch(
        `${SERVER_URL}/api/projects/${createdProject.id}/review`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${govToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "rejected",
            rejectionReason: "Out of scope for this office.",
          }),
        },
      );
      expect(rejectResponse.status, await rejectResponse.text()).toBe(200);

      // 3. Project reverted to its source office and back to DRAFT.
      const [revertedProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, createdProject.id))
        .limit(1);
      expect(revertedProject.officeId).toBe(sourceOfficeId);
      expect(revertedProject.ownershipStatus).toBe("draft");

      // 4. Submitter restored to OWNER so they can edit/resubmit.
      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, citizenUser.id),
            eq(projectUsers.projectId, createdProject.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("owner");
    } finally {
      await close();
    }
  });
});
