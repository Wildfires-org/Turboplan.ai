import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import {
  office,
  officeUsers,
  organization,
  organizationUsers,
  project,
  projectSubmission,
  projectUsers,
  user as userTable,
} from "@wildfires-org/turboplan-db/schemas";
import {
  getOrCreatePersonalWorkspace,
  prepareSubmission,
  SubmissionError,
  submitProjectForReview,
} from "@wildfires-org/turboplan-workspace/server";

/**
 * Personal-workspace + submission helper tests.
 *
 * These exercise the pure-ish server helpers that back the landing-page project
 * creation flow directly (no HTTP), against the real test database:
 *   - getOrCreatePersonalWorkspace — resolves/creates the citizen's personal org+office.
 *   - submitProjectForReview / prepareSubmission — validate + apply a submission.
 *
 * The helpers read/write through the singleton `db` (POSTGRES_URL); global-setup
 * points that at the same physical test DB as TEST_POSTGRES_URL, so the
 * createTestDB() handle used here for seeding/assertions sees the same rows.
 *
 * Runs in the `api` project (no browser).
 */

const suffix = () => Math.random().toString(36).substring(2, 10);

test.describe("getOrCreatePersonalWorkspace", () => {
  test("creates a personal org + office when the user has none", async () => {
    const { db, close } = createTestDB();
    const email = `pw-create-${suffix()}@example.test`;

    try {
      // Insert a bare user with NO personal org (cannot use createMagicLinkUser
      // here — it auto-creates a personal org, which would make this the
      // "existing" path instead of the "create" path).
      const [createdUser] = await db
        .insert(userTable)
        .values({ email })
        .returning();

      const beforeOrgs = await db
        .select()
        .from(organization)
        .where(eq(organization.createdBy, createdUser.id));
      expect(beforeOrgs.length).toBe(0);

      const { organization: org, office: createdOffice } =
        await getOrCreatePersonalWorkspace(createdUser.id, email);

      expect(org.type).toBe("personal");
      expect(org.createdBy).toBe(createdUser.id);
      expect(createdOffice.organizationId).toBe(org.id);

      // Org + office actually persisted and the user owns both.
      const [persistedOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, org.id))
        .limit(1);
      expect(persistedOrg).toBeTruthy();

      const [orgMembership] = await db
        .select()
        .from(organizationUsers)
        .where(
          and(
            eq(organizationUsers.userId, createdUser.id),
            eq(organizationUsers.organizationId, org.id),
          ),
        )
        .limit(1);
      expect(orgMembership?.role).toBe("owner");

      const [officeMembership] = await db
        .select()
        .from(officeUsers)
        .where(
          and(
            eq(officeUsers.userId, createdUser.id),
            eq(officeUsers.officeId, createdOffice.id),
          ),
        )
        .limit(1);
      expect(officeMembership?.role).toBe("owner");
    } finally {
      await close();
    }
  });

  test("returns the OLDEST existing personal org (createdAt ASC), matched on createdBy", async () => {
    const { db, close } = createTestDB();
    const now = new Date();
    const email = `pw-oldest-${suffix()}@example.test`;

    try {
      const [createdUser] = await db
        .insert(userTable)
        .values({ email })
        .returning();

      // Another user's personal org must NOT be matched (createdBy filter).
      const [otherUser] = await db
        .insert(userTable)
        .values({ email: `pw-other-${suffix()}@example.test` })
        .returning();
      await db.insert(organization).values({
        slug: `other-personal-${suffix()}`,
        name: "Other personal",
        type: "personal",
        status: "active",
        createdBy: otherUser.id,
        createdAt: new Date(now.getTime() - 100_000),
        updatedAt: now,
      });

      // Two personal orgs for OUR user; the older one must win.
      const olderCreatedAt = new Date(now.getTime() - 50_000);
      const newerCreatedAt = new Date(now.getTime() - 10_000);

      const [olderOrg] = await db
        .insert(organization)
        .values({
          slug: `older-personal-${suffix()}`,
          name: "Older personal",
          type: "personal",
          status: "active",
          createdBy: createdUser.id,
          createdAt: olderCreatedAt,
          updatedAt: now,
        })
        .returning();
      // An office for the older org so the helper reuses it rather than creating one.
      const [olderOffice] = await db
        .insert(office)
        .values({
          name: "Older office",
          slug: `older-office-${suffix()}`,
          organizationId: olderOrg.id,
          createdBy: createdUser.id,
          status: "active",
          createdAt: olderCreatedAt,
          updatedAt: now,
        })
        .returning();

      await db.insert(organization).values({
        slug: `newer-personal-${suffix()}`,
        name: "Newer personal",
        type: "personal",
        status: "active",
        createdBy: createdUser.id,
        createdAt: newerCreatedAt,
        updatedAt: now,
      });

      const { organization: resolvedOrg, office: resolvedOffice } =
        await getOrCreatePersonalWorkspace(createdUser.id, email);

      expect(resolvedOrg.id).toBe(olderOrg.id);
      // Reuses the oldest existing office in that org; does not create a new one.
      expect(resolvedOffice.id).toBe(olderOffice.id);
    } finally {
      await close();
    }
  });
});

/**
 * Seed a citizen-owned DRAFT project in a freshly created personal org/office.
 * Returns ids needed by the submission tests.
 */
const seedDraftProject = async (
  db: ReturnType<typeof createTestDB>["db"],
  now: Date,
) => {
  const sfx = suffix();
  const [citizen] = await db
    .insert(userTable)
    .values({ email: `submit-citizen-${sfx}@example.test` })
    .returning();

  const [personalOrg] = await db
    .insert(organization)
    .values({
      slug: `submit-personal-${sfx}`,
      name: "Submitter personal",
      type: "personal",
      status: "active",
      createdBy: citizen.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [sourceOffice] = await db
    .insert(office)
    .values({
      name: "Source office",
      slug: `source-office-${sfx}`,
      organizationId: personalOrg.id,
      createdBy: citizen.id,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [draftProject] = await db
    .insert(project)
    .values({
      name: `Submission Project ${sfx}`,
      slug: `submission-project-${sfx}`,
      description: "draft to submit",
      officeId: sourceOffice.id,
      createdBy: citizen.id,
      lastModifiedBy: citizen.id,
      status: "active",
      ownershipStatus: "draft",
      isTemplate: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(projectUsers).values({
    userId: citizen.id,
    projectId: draftProject.id,
    role: "owner",
  });

  return { citizen, personalOrg, sourceOffice, draftProject };
};

test.describe("submitProjectForReview / prepareSubmission", () => {
  test("rejects a personal target organization (target_personal)", async () => {
    const { db, close } = createTestDB();
    const now = new Date();
    try {
      const { citizen, personalOrg, draftProject } = await seedDraftProject(
        db,
        now,
      );

      await expect(
        submitProjectForReview({
          projectId: draftProject.id,
          submittedBy: citizen.id,
          // Submitting to the citizen's OWN personal org is forbidden.
          targetOrganizationId: personalOrg.id,
          targetOfficeId: draftProject.officeId,
        }),
      ).rejects.toMatchObject({
        name: "SubmissionError",
        code: "target_personal",
      });
    } finally {
      await close();
    }
  });

  test("rejects an office that does not belong to the target org (office_mismatch)", async () => {
    const { db, close } = createTestDB();
    const now = new Date();
    const sfx = suffix();
    try {
      const { citizen, draftProject } = await seedDraftProject(db, now);

      // A government org with NO matching office for the id we pass.
      const [govOrg] = await db
        .insert(organization)
        .values({
          slug: `gov-mismatch-${sfx}`,
          name: "Gov mismatch",
          type: "government",
          status: "active",
          createdBy: citizen.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Office id that belongs to a DIFFERENT org (the project's source office).
      await expect(
        prepareSubmission({
          project: draftProject,
          targetOrganizationId: govOrg.id,
          targetOfficeId: draftProject.officeId,
        }),
      ).rejects.toMatchObject({
        name: "SubmissionError",
        code: "office_mismatch",
      });
    } finally {
      await close();
    }
  });

  test("rejects a non-draft project (not_draft)", async () => {
    const { db, close } = createTestDB();
    const now = new Date();
    const sfx = suffix();
    try {
      const { citizen, draftProject } = await seedDraftProject(db, now);

      // Move the project out of DRAFT.
      await db
        .update(project)
        .set({ ownershipStatus: "submitted" })
        .where(eq(project.id, draftProject.id));

      const [govOrg] = await db
        .insert(organization)
        .values({
          slug: `gov-notdraft-${sfx}`,
          name: "Gov not draft",
          type: "government",
          status: "active",
          createdBy: citizen.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const [govOffice] = await db
        .insert(office)
        .values({
          name: "Gov office",
          slug: `gov-office-notdraft-${sfx}`,
          organizationId: govOrg.id,
          createdBy: citizen.id,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await expect(
        submitProjectForReview({
          projectId: draftProject.id,
          submittedBy: citizen.id,
          targetOrganizationId: govOrg.id,
          targetOfficeId: govOffice.id,
        }),
      ).rejects.toMatchObject({
        name: "SubmissionError",
        code: "not_draft",
      });
    } finally {
      await close();
    }
  });

  test("happy path: moves project to target office, sets SUBMITTED, downgrades submitter to viewer, inserts submission row", async () => {
    const { db, close } = createTestDB();
    const now = new Date();
    const sfx = suffix();
    try {
      const { citizen, sourceOffice, draftProject } = await seedDraftProject(
        db,
        now,
      );

      const [govOrg] = await db
        .insert(organization)
        .values({
          slug: `gov-happy-${sfx}`,
          name: "Gov happy",
          type: "government",
          status: "active",
          createdBy: citizen.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const [govOffice] = await db
        .insert(office)
        .values({
          name: "Gov happy office",
          slug: `gov-happy-office-${sfx}`,
          organizationId: govOrg.id,
          createdBy: citizen.id,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const { submission, location } = await submitProjectForReview({
        projectId: draftProject.id,
        submittedBy: citizen.id,
        targetOrganizationId: govOrg.id,
        targetOfficeId: govOffice.id,
      });

      // Submission row inserted with source office captured for revert.
      expect(submission.projectId).toBe(draftProject.id);
      expect(submission.targetOrganizationId).toBe(govOrg.id);
      expect(submission.targetOfficeId).toBe(govOffice.id);
      expect(submission.sourceOfficeId).toBe(sourceOffice.id);
      expect(submission.submittedBy).toBe(citizen.id);

      // Returned location points at the gov org/office.
      expect(location.organizationSlug).toBe(govOrg.slug);
      expect(location.officeSlug).toBe(govOffice.slug);

      // Project physically moved + status SUBMITTED.
      const [movedProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, draftProject.id))
        .limit(1);
      expect(movedProject.officeId).toBe(govOffice.id);
      expect(movedProject.ownershipStatus).toBe("submitted");
      expect(movedProject.slug).toBe(location.projectSlug);

      // Submitter downgraded OWNER -> VIEWER on the project.
      const [membership] = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, citizen.id),
            eq(projectUsers.projectId, draftProject.id),
          ),
        )
        .limit(1);
      expect(membership.role).toBe("viewer");

      // Exactly one submission row for this project.
      const submissionRows = await db
        .select()
        .from(projectSubmission)
        .where(eq(projectSubmission.projectId, draftProject.id));
      expect(submissionRows.length).toBe(1);
    } finally {
      await close();
    }
  });
});
