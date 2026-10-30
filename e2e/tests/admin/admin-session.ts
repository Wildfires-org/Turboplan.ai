import { type Browser, type BrowserContext, expect } from "@playwright/test";

import { addAdminUser } from "@wildfires-org/turboplan-db/queries";

import {
  createNamedTestUser,
  createTestUserWithMagicLink,
  newAnonymousContext,
  type TestUser,
} from "../../utils";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export type SignedInAdmin = {
  user: TestUser;
  /** Cookies of a signed-in browser session, for `browser.newContext()`. */
  storageState: StorageState;
};

const shortId = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

/**
 * Create a fresh user, make them an admin the way "Manage Admins" does (a row
 * in `admin_user`), and sign them in through a magic link. They are a DB admin,
 * not a super admin: super admins are the ADMIN_EMAILS allowlist, which test
 * users are never on.
 */
export const createSignedInAdmin = async (
  browser: Browser,
): Promise<SignedInAdmin> => {
  const email = `admin-e2e-${Date.now()}-${shortId()}@example.test`;
  const user = await createNamedTestUser({
    email,
    firstName: "Ada",
    lastName: "Admin",
  });
  await addAdminUser(user.id, null);

  const { magicLinkUrl } = await createTestUserWithMagicLink(email);
  const context = await newAnonymousContext(browser);
  try {
    const page = await context.newPage();
    await page.goto(magicLinkUrl);
    await expect(page.getByText(/verified|signed in/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForURL((url) => !url.pathname.startsWith("/verify"), {
      timeout: 15_000,
    });
    return { user, storageState: await context.storageState() };
  } finally {
    await context.close();
  }
};
