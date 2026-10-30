import { expect, test } from "@playwright/test";

import {
  createProjectUser,
  getProjectUsers,
} from "@wildfires-org/turboplan-workspace/server";

import { getCitizenCredentials } from "../../config/test-credentials";
import { ProjectMembersPage } from "../../pages/project-members";
import { createNamedTestUser } from "../../utils";
import {
  createCitizenProject,
  deleteTrackedProjects,
  shortId,
} from "./project-helpers";

const getMemberRole = async (projectId: string, userId: string) => {
  const members = await getProjectUsers(projectId);
  return members.find((member) => member.userId === userId)?.role ?? null;
};

/**
 * The project Members page, as the project owner (citizen): change a direct
 * member's role, then remove them. The second member is added straight to the
 * project in the database; nobody signs in as them.
 */
test.describe("Project members", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("changes a member's role and removes the member", async ({ page }) => {
    test.setTimeout(60000);

    const project = await createCitizenProject("Members");
    const id = shortId();
    const member = await createNamedTestUser({
      email: `project-member-${id}@example.test`,
      firstName: "Pat",
      lastName: `Member${id}`,
    });
    const displayName = `Pat Member${id}`;
    await createProjectUser({
      userId: member.id,
      projectId: project.id,
      role: "viewer",
    });

    const ownerEmail = getCitizenCredentials()?.email;
    if (!ownerEmail) {
      throw new Error("Citizen credentials not found");
    }

    const membersPage = new ProjectMembersPage(page);
    await membersPage.goto(project.path, member.email);
    await expect(membersPage.main.getByText(ownerEmail)).toBeVisible();
    await expect(membersPage.roleSelect(member.email)).toHaveText("Viewer");

    // Viewer -> Editor, kept after a reload and in the database.
    await membersPage.changeRole(member.email, "Editor");
    await page.reload();
    await expect(membersPage.roleSelect(member.email)).toHaveText("Editor", {
      timeout: 15000,
    });
    expect(await getMemberRole(project.id, member.id)).toBe("editor");

    // Remove: gone after a reload and from the database; the owner stays.
    await membersPage.removeMember(displayName, member.email);
    await page.reload();
    await expect(membersPage.main.getByText(ownerEmail)).toBeVisible({
      timeout: 15000,
    });
    await expect(membersPage.main.getByText(member.email)).toHaveCount(0);
    expect(await getMemberRole(project.id, member.id)).toBeNull();
  });
});
