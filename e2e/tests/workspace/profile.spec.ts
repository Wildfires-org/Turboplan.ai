import { expect, type Page, test } from "@playwright/test";

import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";

import {
  type ProfileFieldLabel,
  WorkspaceProfilePage,
} from "../../pages/workspace-profile";
import {
  createNamedTestUser,
  createTestUserWithMagicLink,
  type TestUser,
} from "../../utils";

/**
 * Profile page (`/profile`): saving the profile form, the email field, and
 * signing out from the sidebar user menu.
 *
 * Every test signs in as a fresh user with a named profile (magic link with a
 * `redirectTo`, so onboarding is skipped): editing or signing out the shared
 * citizen/gov users would change what other specs see.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

const signInAsFreshUser = async (
  page: Page,
  label: string,
): Promise<{ user: TestUser; profilePage: WorkspaceProfilePage }> => {
  const user = await createNamedTestUser({
    email: `profile-${label}-${Date.now()}-${shortId()}@example.test`,
    firstName: "Pat",
    lastName: `Profile${shortId()}`,
  });
  const { magicLinkUrl } = await createTestUserWithMagicLink(user.email);
  const profilePage = new WorkspaceProfilePage(page);
  await profilePage.signInWithMagicLink(magicLinkUrl);
  await profilePage.expectLoaded();
  return { user, profilePage };
};

test.describe("Profile page", () => {
  // Magic-link sign-in plus a save and a reload per test, against the remote
  // test database.
  test.describe.configure({ timeout: 60000 });

  test("saves the profile fields and shows them after a reload", async ({
    page,
  }) => {
    const { user, profilePage } = await signInAsFreshUser(page, "edit");
    const values: Record<ProfileFieldLabel, string> = {
      "First Name": "Jordan",
      "Last Name": `Rivera${shortId()}`,
      Phone: "(555) 555-0142",
      "Street Address": "100 Forest Lane",
      "Unit Number": "Suite 4",
      "City or Town": "Redding",
      State: "CA",
      "Zip Code": "96001",
      "Job Title": "Environmental Planner",
    };

    await expect(profilePage.emailInput).toHaveValue(user.email);
    await expect(profilePage.emailInput).toBeDisabled();

    for (const [label, value] of Object.entries(values)) {
      await profilePage.field(label as ProfileFieldLabel).fill(value);
    }
    await profilePage.save();

    await expect
      .poll(async () => (await getProfileByUserId(user.id))?.lastName, {
        timeout: 15000,
      })
      .toBe(values["Last Name"]);
    const saved = await getProfileByUserId(user.id);
    expect(saved).toMatchObject({
      firstName: values["First Name"],
      lastName: values["Last Name"],
      phone: values.Phone,
      streetAddress: values["Street Address"],
      unitNumber: values["Unit Number"],
      city: values["City or Town"],
      state: values.State,
      zipCode: values["Zip Code"],
      jobTitle: values["Job Title"],
    });

    await page.reload();
    await profilePage.expectLoaded();
    for (const [label, value] of Object.entries(values)) {
      await expect(profilePage.field(label as ProfileFieldLabel)).toHaveValue(
        value,
      );
    }
  });

  test("trims surrounding whitespace from saved values", async ({ page }) => {
    const { user, profilePage } = await signInAsFreshUser(page, "trim");
    const jobTitle = `Forester ${shortId()}`;

    await profilePage.field("Job Title").fill(`   ${jobTitle}   `);
    await profilePage.save();

    await expect
      .poll(async () => (await getProfileByUserId(user.id))?.jobTitle, {
        timeout: 15000,
      })
      .toBe(jobTitle);

    await page.reload();
    await profilePage.expectLoaded();
    await expect(profilePage.field("Job Title")).toHaveValue(jobTitle);
  });

  test("clearing an optional field removes it", async ({ page }) => {
    const { user, profilePage } = await signInAsFreshUser(page, "clear");
    const phone = "(555) 555-0199";

    await profilePage.field("Phone").fill(phone);
    await profilePage.save();
    await expect
      .poll(async () => (await getProfileByUserId(user.id))?.phone, {
        timeout: 15000,
      })
      .toBe(phone);

    await page.reload();
    await profilePage.expectLoaded();
    await expect(profilePage.field("Phone")).toHaveValue(phone);
    await profilePage.field("Phone").fill("");
    await profilePage.save();

    await page.waitForLoadState("networkidle");
    await page.reload();
    await profilePage.expectLoaded();
    await expect(profilePage.field("Phone")).toHaveValue("");
    expect((await getProfileByUserId(user.id))?.phone ?? null).toBeNull();
  });

  test("signs out from the sidebar user menu", async ({ page }) => {
    const { user, profilePage } = await signInAsFreshUser(page, "logout");

    await profilePage.signOutFromUserMenu(user.email);
    await page.waitForURL((url) => url.pathname === "/login", {
      timeout: 20000,
    });

    const cookies = await page.context().cookies();
    expect(
      cookies.some((cookie) => cookie.name.includes("authjs.session-token")),
    ).toBe(false);

    // The session is gone: the app's entry page sends the visitor to login.
    await page.goto("/");
    await page.waitForURL((url) => url.pathname === "/login", {
      timeout: 15000,
    });
  });

  // /profile has no session guard of its own; the middleware sends a
  // signed-out visitor to login and remembers where they were going.
  test("a signed-out visitor to /profile is sent to login", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForURL((url) => url.pathname === "/login", {
      timeout: 10000,
    });
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      "/profile",
    );
  });
});
