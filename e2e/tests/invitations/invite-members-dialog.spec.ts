import { expect, type Page, test } from "@playwright/test";

import { getCitizenCredentials } from "../../config";
import { TurboplanMembersPage } from "../../pages";
import {
  addOrganizationOfficeViewer,
  createNamedTestUser,
  createTestOrganization,
  getCitizenWorkspace,
} from "../../utils";

/**
 * Invite Members dialog (InviteMembersDialog → MemberAssignRow → UserSelector).
 *
 * There is no "Assign" step: picking a suggestion (Enter or click) adds the
 * person straight to the pending list with the current default role, and
 * "Send Invitation" sends the list. Guards three regressions found in manual
 * testing:
 *  - an email already pending (in any case) or already a member could be
 *    added a second time;
 *  - Enter on an existing user's exact email could pick another, fuzzy
 *    suggestion still highlighted from an earlier query;
 *  - the suggestions dropdown stayed open after a pick and covered the
 *    pending list, so its Remove buttons could not be clicked.
 *
 * Runs as the citizen user (default auth state) on a fresh organization it
 * owns, so no invite leaks into the shared workspaces. Only viewers are ever
 * sent (Editor is picked once, never sent), so the spec does not depend on
 * paid-seat state when billing is enabled.
 */

const shortId = (): string => Math.random().toString(36).substring(2, 6);

/** An email no user has, unique per call. */
const newEmail = (label: string): string =>
  `invite-e2e-${label}-${Date.now()}-${shortId()}@example.test`;

/** An existing user who is NOT a member of the organization. */
const EXACT_USER = { firstName: "Erin", lastName: "Exact" };
/** A user in the organization's tree whose email shares the exact user's prefix. */
const DECOY_USER = { firstName: "Dana", lastName: "Decoy" };

const displayName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;

test.describe("Invite Members dialog", () => {
  let ownerEmail: string;
  let orgSlug: string;
  /** Matches both the exact user's and the decoy's email, but is no email. */
  let sharedPrefix: string;
  let exactUserEmail: string;

  test.beforeAll(async () => {
    const citizen = await getCitizenWorkspace();
    const credentials = getCitizenCredentials();
    if (!credentials) {
      throw new Error("Citizen credentials not found.");
    }
    ownerEmail = credentials.email.toLowerCase();

    const org = await createTestOrganization({
      ownerId: citizen.userId,
      name: `Invite Dialog E2E ${Date.now()}-${shortId()}`,
    });
    orgSlug = org.slug;

    sharedPrefix = `invitee-${Date.now()}-${shortId()}`;
    exactUserEmail = `${sharedPrefix}@example.test`;

    // Outside the organization: the search finds them only by exact email.
    await createNamedTestUser({ email: exactUserEmail, ...EXACT_USER });

    // In the organization's tree (an office viewer, not an org member): the
    // search fuzzy-matches them on the shared prefix.
    const decoy = await createNamedTestUser({
      email: `${sharedPrefix}-decoy@example.test`,
      ...DECOY_USER,
    });
    await addOrganizationOfficeViewer({
      organizationId: org.id,
      ownerId: citizen.userId,
      userId: decoy.id,
    });
  });

  const openDialog = async (page: Page) => {
    const members = new TurboplanMembersPage(page);
    await members.gotoOrganization(orgSlug, ownerEmail);
    return members.openInviteDialog();
  };

  test("Enter on a new email adds it to the pending list and clears the input", async ({
    page,
  }) => {
    const email = newEmail("enter");
    const dialog = await openDialog(page);
    await expect(dialog.sendButton).toBeDisabled();

    await dialog.addEmailWithEnter(email);

    await expect(dialog.removeButton(email)).toBeVisible();
    await expect(dialog.removeButtons).toHaveCount(1);
    await expect(dialog.searchInput).toHaveValue("");
    await expect(dialog.sendButton).toBeEnabled();
  });

  test("an email already pending (any case) or already a member is not added again", async ({
    page,
  }) => {
    const email = newEmail("dupe");
    const dialog = await openDialog(page);
    await dialog.addEmailWithEnter(email);
    await expect(dialog.removeButton(email)).toBeVisible();

    // Same email, different case: a hint and nothing to pick. A pick would
    // clear the input, so a kept value proves Enter added nothing.
    const upperCased = email.toUpperCase();
    await dialog.type(upperCased);
    await expect(dialog.takenHint(upperCased)).toBeVisible();
    await expect(dialog.inviteOption).toBeHidden();
    await dialog.pressEnter();
    await expect(dialog.searchInput).toHaveValue(upperCased);
    await expect(dialog.removeButtons).toHaveCount(1);

    // An existing member (the owner).
    await dialog.type(ownerEmail);
    await expect(dialog.takenHint(ownerEmail)).toBeVisible();
    await expect(dialog.inviteOption).toBeHidden();
    await dialog.pressEnter();
    await expect(dialog.searchInput).toHaveValue(ownerEmail);
    await expect(dialog.removeButtons).toHaveCount(1);
  });

  test("Enter on an existing user's exact email adds that user, not a fuzzy match", async ({
    page,
  }) => {
    const dialog = await openDialog(page);

    // Precondition: a partial query suggests (and highlights) the decoy.
    await dialog.type(sharedPrefix);
    await expect(dialog.userOption(displayName(DECOY_USER))).toBeVisible();

    // The full email resolves to its exact user only: no decoy, and no
    // "Create and invite" once the search has found the user.
    await dialog.type(exactUserEmail);
    await expect(dialog.userOption(displayName(EXACT_USER))).toBeVisible();
    await expect(dialog.userOption(displayName(DECOY_USER))).toBeHidden();
    await expect(dialog.inviteOption).toBeHidden();
    await dialog.pressEnter();

    // Added as the existing user (named by display name), not as an email.
    await expect(dialog.removeButton(displayName(EXACT_USER))).toBeVisible();
    await expect(dialog.removeButtons).toHaveCount(1);
    await expect(dialog.searchInput).toHaveValue("");
  });

  test("a pick closes the suggestions, so the pending row's Remove button is clickable", async ({
    page,
  }) => {
    const dialog = await openDialog(page);

    // Keyboard pick.
    const enterEmail = newEmail("remove-enter");
    await dialog.addEmailWithEnter(enterEmail);
    await expect(dialog.suggestions).toBeHidden();
    await dialog.removeButton(enterEmail).click();
    await expect(dialog.removeButton(enterEmail)).toBeHidden();
    await expect(dialog.sendButton).toBeDisabled();

    // Mouse pick: the click blurs the input and the pick refocuses it, which
    // must not reopen the suggestions.
    const clickEmail = newEmail("remove-click");
    await dialog.type(clickEmail);
    await dialog.inviteOption.click();
    await expect(dialog.removeButton(clickEmail)).toBeVisible();
    await expect(dialog.suggestions).toBeHidden();
    await dialog.removeButton(clickEmail).click();
    await expect(dialog.removeButton(clickEmail)).toBeHidden();
    await expect(dialog.sendButton).toBeDisabled();
  });

  test("the default role select sets the role of the next pick", async ({
    page,
  }) => {
    const email = newEmail("editor");
    const dialog = await openDialog(page);
    await expect(dialog.defaultRoleSelect).toHaveText("Viewer");

    await dialog.chooseDefaultRole("Editor");
    await expect(dialog.defaultRoleSelect).toHaveText("Editor");

    await dialog.addEmailWithEnter(email);
    await expect(dialog.pendingRoleSelect(email)).toHaveText("Editor");
  });

  test("Send Invitation sends the pending list as pending invitations", async ({
    page,
  }) => {
    const emails = [newEmail("send-a"), newEmail("send-b")];
    const members = new TurboplanMembersPage(page);
    await members.gotoOrganization(orgSlug, ownerEmail);
    const dialog = await members.openInviteDialog();

    for (const email of emails) {
      await dialog.addEmailWithEnter(email);
      await expect(dialog.pendingRoleSelect(email)).toHaveText("Viewer");
    }

    await dialog.send();

    await expect(dialog.dialog).toBeHidden({ timeout: 15000 });
    await expect(
      page.getByTestId("toast").filter({ hasText: "2 invitations sent." }),
    ).toBeVisible();
    for (const email of emails) {
      await members.expectPendingInvitation(email);
    }
  });
});
