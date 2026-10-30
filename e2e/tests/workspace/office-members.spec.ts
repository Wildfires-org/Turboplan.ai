import { expect, test } from "@playwright/test";

import {
  createOffice,
  createOfficeUser,
  createOrganizationUser,
  getOfficeUsers,
} from "@wildfires-org/turboplan-workspace/server";

import { getGovCredentials } from "../../config";
import { WorkspaceMembersTable } from "../../pages/workspace-members-table";
import {
  createNamedTestUser,
  createTestOrganization,
  getGovWorkspace,
} from "../../utils";

/**
 * Office Members tab: direct vs inherited members, change a member's role and
 * remove a member.
 *
 * Runs as the government user, owner of a fresh BUSINESS organization; each
 * test gets its own office there, which makes the user a direct office owner
 * too. Organization members who hold no office role reach the office by
 * inheritance, so they show under the Inherited access filter, not under the
 * default Direct one. Members are only demoted or removed (see the
 * organization members spec for why).
 */
test.use({ storageState: "./storage/auth/gov.json" });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

test.describe("Office members page", () => {
  // Several page loads per test against the remote test database.
  test.describe.configure({ timeout: 60000 });

  let ownerId: string;
  let ownerEmail: string;
  let orgId: string;
  let orgSlug: string;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    ownerId = gov.userId;
    const credentials = getGovCredentials();
    if (!credentials) {
      throw new Error("Gov credentials not found.");
    }
    ownerEmail = credentials.email.toLowerCase();
    const org = await createTestOrganization({
      ownerId,
      name: `Office Members E2E ${shortId()}`,
    });
    orgId = org.id;
    orgSlug = org.slug;
  });

  /** A verified user with a display name ("First Last"). */
  const seedNamedUser = async (label: string) => {
    const id = shortId();
    const person = { firstName: label, lastName: `Person${id}` };
    const user = await createNamedTestUser({
      email: `office-${label.toLowerCase()}-${Date.now()}-${id}@example.test`,
      ...person,
    });
    return { ...user, displayName: `${person.firstName} ${person.lastName}` };
  };

  /** A fresh office with one named direct member holding `role`. */
  const seedOfficeWithMember = async (role: "editor" | "viewer") => {
    const office = await createOffice({
      name: `Members Office ${shortId()}`,
      organizationId: orgId,
      createdBy: ownerId,
    });
    const member = await seedNamedUser("Olive");
    await createOfficeUser({ officeId: office.id, userId: member.id, role });
    return { office, member };
  };

  const officeRole = async (officeId: string, userId: string) => {
    const rows = await getOfficeUsers(officeId);
    return rows.find((row) => row.userId === userId)?.role ?? null;
  };

  test("lists direct members by default and organization members as inherited", async ({
    page,
  }) => {
    const { office, member } = await seedOfficeWithMember("viewer");
    // An organization viewer with no role on this office.
    const orgMember = await seedNamedUser("Ingrid");
    await createOrganizationUser({
      organizationId: orgId,
      userId: orgMember.id,
      role: "viewer",
    });
    const members = new WorkspaceMembersTable(page);

    await members.gotoOffice(orgSlug, office.slug, member.email);
    await expect(members.accessFilter).toContainText("Direct");
    // The office creator is a direct owner, shown as "You" without controls.
    const ownerRow = members.row(ownerEmail);
    await expect(ownerRow.getByText("You", { exact: true })).toBeVisible();
    await expect(ownerRow.getByRole("combobox")).toHaveCount(0);
    await members.expectNotListed(orgMember.email);

    await members.filterByAccess("Inherited");
    await members.expectListed(orgMember.email);
    await members.expectNotListed(member.email);
    // An inherited role is read-only here: no select, no actions menu.
    const inheritedRow = members.row(orgMember.email);
    await expect(
      inheritedRow.getByText("Viewer", { exact: true }),
    ).toBeVisible();
    await expect(inheritedRow.getByRole("combobox")).toHaveCount(0);
    await expect(members.actionsButton(orgMember.displayName)).toHaveCount(0);

    await members.filterByAccess("All");
    await members.expectListed(orgMember.email);
    await members.expectListed(member.email);
  });

  test("demotes an office editor to viewer", async ({ page }) => {
    const { office, member } = await seedOfficeWithMember("editor");
    const members = new WorkspaceMembersTable(page);

    await members.gotoOffice(orgSlug, office.slug, member.email);
    await expect(members.roleSelect(member.email)).toHaveText("Editor");

    await members.changeRole(member.email, "Viewer");

    await expect.poll(() => officeRole(office.id, member.id)).toBe("viewer");

    await page.reload();
    await members.expectListed(member.email);
    await expect(members.roleSelect(member.email)).toHaveText("Viewer");
  });

  test("removes an office member", async ({ page }) => {
    const { office, member } = await seedOfficeWithMember("viewer");
    const members = new WorkspaceMembersTable(page);

    await members.gotoOffice(orgSlug, office.slug, member.email);
    await members.chooseRowAction(member.displayName, "Remove member");
    await members.expectNotListed(member.email);

    await expect.poll(() => officeRole(office.id, member.id)).toBeNull();

    await page.reload();
    await members.expectListed(ownerEmail);
    await members.expectNotListed(member.email);
  });
});
