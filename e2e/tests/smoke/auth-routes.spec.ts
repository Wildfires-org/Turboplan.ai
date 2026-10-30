import {
  type Browser,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test";

import {
  createOwnedWorkspace,
  createTestInvitation,
  createTestUserWithMagicLink,
  newAnonymousContext,
} from "../../utils";
import {
  expectHealthyPage,
  mainHeading,
  watchPageProblems,
} from "./route-health";

/**
 * Route smoke for the `(auth)` pages and the other pages a signed-out visitor
 * can open. Every test uses its own cookie-less context, so nothing here can
 * sign a shared test user out.
 */

const shortId = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

type SignedOutRoute = {
  path: string;
  heading: string;
};

const SIGNED_OUT_ROUTES: SignedOutRoute[] = [
  { path: "/login", heading: "Sign In" },
  { path: "/register", heading: "Sign Up" },
  { path: "/check-email", heading: "Check your inbox" },
  // Opened without a token, it explains the link is invalid.
  { path: "/verify", heading: "Verification failed" },
  // Signed out, the self-service form signs the visitor up as well.
  { path: "/self-service", heading: "Sign up for TurboPlan" },
];

/**
 * Sign a fresh user in through a magic link. Returns the signed-in context;
 * the sign-in page is closed, so its in-flight requests cannot leak console
 * errors into the page a test checks next.
 */
const signInFreshUser = async (browser: Browser): Promise<BrowserContext> => {
  const { magicLinkUrl } = await createTestUserWithMagicLink(
    `smoke-auth-${Date.now()}-${shortId()}@example.test`,
  );
  const context = await newAnonymousContext(browser);
  const signInPage = await context.newPage();

  await signInPage.goto(magicLinkUrl);
  await expect(signInPage.getByText(/verified|signed in/i)).toBeVisible({
    timeout: 15_000,
  });
  await signInPage.waitForURL((url) => !url.pathname.startsWith("/verify"), {
    timeout: 15_000,
  });
  await signInPage.close();
  return context;
};

test.describe("Route smoke - signed-out visitor", () => {
  for (const route of SIGNED_OUT_ROUTES) {
    test(route.path, async ({ browser }) => {
      const context = await newAnonymousContext(browser);
      const page = await context.newPage();
      const problems = watchPageProblems(page);

      await page.goto(route.path);

      await expect(page).toHaveURL(route.path);
      await expectHealthyPage(page, mainHeading(page, route.heading), problems);
      await context.close();
    });
  }

  test("/check-email shows the address the link was sent to", async ({
    browser,
  }) => {
    const context = await newAnonymousContext(browser);
    const page = await context.newPage();
    const email = `smoke-check-${shortId()}@example.test`;

    await page.goto(`/check-email?email=${encodeURIComponent(email)}`);

    await expect(mainHeading(page, "Check your inbox")).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await context.close();
  });

  test("/invite/[token] shows a pending invitation", async ({ browser }) => {
    const workspace = await createOwnedWorkspace("smoke-invite");
    const invitation = await createTestInvitation({
      email: `smoke-invitee-${Date.now()}-${shortId()}@example.test`,
      entityType: "project",
      entityId: workspace.projectId,
      entityName: "Smoke invite project",
      role: "viewer",
      invitedBy: workspace.owner.id,
    });
    if (!invitation) {
      throw new Error("Failed to create the invitation");
    }

    const context = await newAnonymousContext(browser);
    const page = await context.newPage();
    const problems = watchPageProblems(page);

    await page.goto(`/invite/${invitation.token}`);

    await expectHealthyPage(
      page,
      mainHeading(page, "You've Been Invited!"),
      problems,
    );
    await context.close();
  });

  for (const path of ["/", "/profile"]) {
    test(`${path} sends a signed-out visitor to /login`, async ({
      browser,
    }) => {
      const context = await newAnonymousContext(browser);
      const page = await context.newPage();

      await page.goto(path);

      await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });
      await expect(mainHeading(page, "Sign In")).toBeVisible();
      await context.close();
    });
  }
});

test.describe("Route smoke - first sign-in", () => {
  test("/setup/personal asks a new user about themselves", async ({
    browser,
  }) => {
    const context = await signInFreshUser(browser);
    const page = await context.newPage();
    const problems = watchPageProblems(page);

    await page.goto("/setup/personal");

    await expect(page).toHaveURL("/setup/personal");
    await expectHealthyPage(
      page,
      mainHeading(page, "Tell us a little about yourself"),
      problems,
    );
    await context.close();
  });

  test("/logout signs the user out", async ({ browser }) => {
    const context = await signInFreshUser(browser);
    const page = await context.newPage();
    const problems = watchPageProblems(page);

    await page.goto("/logout");

    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });
    await expectHealthyPage(page, mainHeading(page, "Sign In"), problems);

    // The session is gone: a protected page now asks to sign in again.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });
    await context.close();
  });
});
