import { expect, test } from "@playwright/test";

import { createOrganizationUser } from "@wildfires-org/turboplan-workspace/server";

import { getGovCredentials } from "../../config";
import { WorkspaceMembersTable } from "../../pages/workspace-members-table";
import {
  createNamedTestUser,
  createTestInvitation,
  createTestOrganization,
  getGovWorkspace,
  getInvitationStatus,
  getOrgMembershipRole,
  type TestOrganization,
} from "../../utils";

/**
 * Organization Members tab: change a member's role, remove a member, revoke a
 * pending invitation, and the owner's own row.
 *
 * Runs as the government user on a fresh BUSINESS organization it owns. Each
 * test seeds its own member, so tests stay independent in parallel. Members
 * are only ever demoted or removed: promotion into a billable role goes
 * through the seat gate, which the billing spec covers.
 */
test.use({ storageState: "./storage/auth/gov.json" });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

test.describe("Organization members page", () => {
  // Several page loads per test against the remote test database.
  test.describe.configure({ timeout: 60000 });

  let ownerId: string;
  let ownerEmail: string;
  let org: TestOrganization;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    ownerId = gov.userId;
    const credentials = getGovCredentials();
    if (!credentials) {
      throw new Error("Gov credentials not found.");
    }
    ownerEmail = credentials.email.toLowerCase();
    org = await createTestOrganization({
      ownerId,
      name: `Org Members E2E ${shortId()}`,
    });
  });

  /** A named user added straight to the organization with `role`. */
  const seedMember = async (role: "editor" | "viewer") => {
    const id = shortId();
    const person = { firstName: "Morgan", lastName: `Member${id}` };
    const user = await createNamedTestUser({
      email: `org-member-${Date.now()}-${id}@example.test`,
      ...person,
    });
    await createOrganizationUser({
      organizationId: org.id,
      userId: user.id,
      role,
    });
    return {
      ...user,
      displayName: `${person.firstName} ${person.lastName}`,
    };
  };

  test("lists the owner without controls on their own row", async ({
    page,
  }) => {
    const members = new WorkspaceMembersTable(page);
    await members.gotoOrganization(org.slug, ownerEmail);

    const ownRow = members.row(ownerEmail);
    await expect(ownRow.getByText("You", { exact: true })).toBeVisible();
    await expect(ownRow.getByText("Owner", { exact: true })).toBeVisible();
    // Nobody changes their own role or removes themselves from this table.
    await expect(ownRow.getByRole("combobox")).toHaveCount(0);
    await expect(
      ownRow.getByRole("button", { name: /^Actions for/ }),
    ).toHaveCount(0);
  });

  test("demotes an editor to viewer", async ({ page }) => {
    const member = await seedMember("editor");
    const members = new WorkspaceMembersTable(page);

    await members.gotoOrganization(org.slug, member.email);
    await expect(members.roleSelect(member.email)).toHaveText("Editor");

    await members.changeRole(member.email, "Viewer");

    await expect
      .poll(() => getOrgMembershipRole(org.id, member.id))
      .toBe("viewer");

    await page.reload();
    await members.expectListed(member.email);
    await expect(members.roleSelect(member.email)).toHaveText("Viewer");
  });

  test("removes a member", async ({ page }) => {
    const member = await seedMember("viewer");
    const members = new WorkspaceMembersTable(page);

    await members.gotoOrganization(org.slug, member.email);
    await members.chooseRowAction(member.displayName, "Remove member");
    await members.expectNotListed(member.email);

    await expect.poll(() => getOrgMembershipRole(org.id, member.id)).toBeNull();

    await page.reload();
    await members.expectListed(ownerEmail);
    await members.expectNotListed(member.email);
  });

  test("revokes a pending invitation", async ({ page }) => {
    const email = `org-invitee-${Date.now()}-${shortId()}@example.test`;
    const invitation = await createTestInvitation({
      email,
      entityType: "organization",
      entityId: org.id,
      entityName: org.name,
      role: "viewer",
      invitedBy: ownerId,
    });
    if (!invitation) {
      throw new Error("Failed to create the invitation");
    }
    const rowName = email.split("@")[0];
    const members = new WorkspaceMembersTable(page);

    await members.gotoOrganization(org.slug, rowName);
    await expect(
      members.row(rowName).getByText("pending invitation", { exact: true }),
    ).toBeVisible();

    await members.chooseRowAction(rowName, "Revoke invitation");
    await expect(page.getByText("Invitation revoked.")).toBeVisible({
      timeout: 10000,
    });

    await expect
      .poll(() => getInvitationStatus(invitation.token))
      .toBe("revoked");

    await page.reload();
    await members.expectListed(ownerEmail);
    await members.expectNotListed(rowName);
  });
});
