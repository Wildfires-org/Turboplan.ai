import { expect, test } from "@playwright/test";

import { createToken } from "@wildfires-org/turboplan-api-client/server";
import { removeAdminUser } from "@wildfires-org/turboplan-db/queries";

import { OFFICE_URL_PATTERN } from "../../config";
import {
  ADMIN_DASHBOARD,
  ADMIN_ROUTES,
  ADMIN_USERS_ROUTE,
  AdminPanelPage,
} from "../../pages/admin-panel";
import { authHeaders, createApiTestUser } from "../../utils";
import { expectHealthyPage, watchPageProblems } from "../smoke/route-health";
import { createSignedInAdmin, type SignedInAdmin } from "./admin-session";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

/**
 * Who may open the admin panel. The (admin) layout lets in super admins
 * (ADMIN_EMAILS) and users with an `admin_user` row, and redirects everyone
 * else to "/"; the API guards /api/admin/* the same way.
 */
test.describe("Admin panel - non-admin", () => {
  // `page` is the default citizen user, who is not an admin.
  for (const route of [...ADMIN_ROUTES, ADMIN_USERS_ROUTE]) {
    test(`${route.path} sends a non-admin back to their workspace`, async ({
      page,
    }) => {
      const admin = new AdminPanelPage(page);

      await admin.goto(route.path);

      await expect(page).toHaveURL(OFFICE_URL_PATTERN, { timeout: 15_000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(admin.heading(route.heading)).toHaveCount(0);
    });
  }

  test("the admin API refuses a non-admin", async ({ request }) => {
    const user = await createApiTestUser("admin-api-non-admin");

    const prompts = await request.get(`${SERVER_URL}/api/admin/prompts`, {
      headers: authHeaders(user),
    });
    expect(prompts.status()).toBe(403);

    const status = await request.get(`${SERVER_URL}/api/admin-status`, {
      headers: authHeaders(user),
    });
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({
      isAdmin: false,
      isSuperAdmin: false,
    });
  });
});

test.describe("Admin panel - admin", () => {
  let admin: SignedInAdmin;

  test.beforeAll(async ({ browser }) => {
    admin = await createSignedInAdmin(browser);
  });

  test.afterAll(async () => {
    if (admin) {
      await removeAdminUser(admin.user.id);
    }
  });

  for (const route of ADMIN_ROUTES) {
    test(`an admin can open ${route.path}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: admin.storageState,
      });
      const page = await context.newPage();
      const adminPanel = new AdminPanelPage(page);
      const problems = watchPageProblems(page);

      await adminPanel.goto(route.path);

      await expect(page).toHaveURL(route.path);
      await expectHealthyPage(
        page,
        adminPanel.heading(route.heading),
        problems,
      );
      await context.close();
    });
  }

  test("the dashboard links to every page a DB admin may open", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: admin.storageState,
    });
    const page = await context.newPage();
    const adminPanel = new AdminPanelPage(page);

    await adminPanel.goto(ADMIN_DASHBOARD.path);
    await adminPanel.expectOnPage(ADMIN_DASHBOARD);

    for (const title of [
      "Prompt Management",
      "Webhook Logs",
      "Cataloger",
      "AI Models",
    ]) {
      await expect(adminPanel.dashboardCard(title)).toBeVisible();
    }
    // Managing admins is for super admins only.
    await expect(adminPanel.dashboardCard("Manage Admins")).toHaveCount(0);

    await adminPanel.dashboardCard("Webhook Logs").click();
    await adminPanel.expectOnPage({
      path: "/admin/webhook-logs",
      heading: "Webhook Logs",
    });
    await context.close();
  });

  test("/admin/users sends a DB admin back to the dashboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: admin.storageState,
    });
    const page = await context.newPage();
    const adminPanel = new AdminPanelPage(page);

    await adminPanel.goto(ADMIN_USERS_ROUTE.path);

    await adminPanel.expectOnPage(ADMIN_DASHBOARD);
    await expect(adminPanel.heading(ADMIN_USERS_ROUTE.heading)).toHaveCount(0);
    await context.close();
  });

  test("the admin API answers an admin", async ({ request }) => {
    const headers = authHeaders({
      ...admin.user,
      token: await createToken({ id: admin.user.id }),
    });

    const prompts = await request.get(`${SERVER_URL}/api/admin/prompts`, {
      headers,
    });
    expect(prompts.status()).toBe(200);

    const status = await request.get(`${SERVER_URL}/api/admin-status`, {
      headers,
    });
    expect(await status.json()).toEqual({ isAdmin: true, isSuperAdmin: false });

    // Any admin may list admins, but adding one needs a super admin. The body
    // names the admin themselves, so even a broken guard would change nothing.
    const addAdmin = await request.post(`${SERVER_URL}/api/admin/admin-users`, {
      headers,
      data: { userId: admin.user.id },
    });
    expect(addAdmin.status()).toBe(403);
  });
});
