import { expect, type Locator, type Page, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import {
  getCitizenWorkspace,
  getTestOffice,
  getTestUserOrganization,
} from "../../utils";
import {
  ABORTED_BY_DASHBOARD_REDIRECT,
  expectHealthyPage,
  mainHeading,
  watchPageProblems,
} from "./route-health";

/**
 * Route smoke for the citizen user (the default `page` auth): the pages a
 * citizen works with in their personal workspace, and the role-gated office
 * pages, which send a citizen to the opposite page from a gov user.
 * Everything else is covered for the gov owner in gov-routes.spec.ts.
 */
test.describe.configure({ mode: "default" });

type CitizenContext = {
  orgSlug: string;
  orgName: string;
  officeSlug: string;
  officeName: string;
};

type CitizenRoute = {
  route: string;
  path: (ctx: CitizenContext) => string;
  landmark: (page: Page, ctx: CitizenContext) => Locator;
  /** Where the route lands when it redirects. Defaults to `path`. */
  expectedUrl?: (ctx: CitizenContext) => string | RegExp;
  allowedConsoleErrors?: RegExp[];
};

const office = (ctx: CitizenContext): string => {
  return appPaths.office(ctx.orgSlug, ctx.officeSlug);
};

const officeHeading = (page: Page, ctx: CitizenContext): Locator => {
  return mainHeading(page, ctx.officeName);
};

const ROUTES: CitizenRoute[] = [
  {
    route: "/",
    path: () => "/",
    landmark: officeHeading,
    // A citizen lands in their personal office.
    expectedUrl: office,
  },
  {
    route: "/profile",
    path: () => "/profile",
    landmark: (page) => mainHeading(page, "Profile"),
  },
  {
    route: "/self-service",
    path: () => "/self-service",
    landmark: (page) => mainHeading(page, "Create New Project"),
  },
  {
    route: "/[orgSlug]",
    path: (ctx) => appPaths.organization(ctx.orgSlug),
    landmark: (page, ctx) => mainHeading(page, ctx.orgName),
  },
  {
    route: "/[orgSlug]/[officeSlug]",
    path: office,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/my-submissions",
    path: (ctx) => `${office(ctx)}/my-submissions`,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/citizen-submissions",
    path: (ctx) => `${office(ctx)}/citizen-submissions`,
    landmark: officeHeading,
    // Government-only: a citizen is sent to the office page.
    expectedUrl: office,
    allowedConsoleErrors: ABORTED_BY_DASHBOARD_REDIRECT,
  },
];

test.describe("Route smoke - citizen", () => {
  let ctx: CitizenContext;

  test.beforeAll(async () => {
    const workspace = await getCitizenWorkspace();
    const organization = await getTestUserOrganization(workspace.userId);
    if (!organization) {
      throw new Error("Citizen organization not found");
    }
    const citizenOffice = await getTestOffice(organization.id);
    if (!citizenOffice) {
      throw new Error("Citizen office not found");
    }

    ctx = {
      orgSlug: organization.slug,
      orgName: organization.name,
      officeSlug: citizenOffice.slug,
      officeName: citizenOffice.name,
    };
  });

  for (const citizenRoute of ROUTES) {
    test(citizenRoute.route, async ({ page }) => {
      const problems = watchPageProblems(
        page,
        citizenRoute.allowedConsoleErrors,
      );

      await page.goto(citizenRoute.path(ctx));

      const expectedUrl =
        citizenRoute.expectedUrl?.(ctx) ?? citizenRoute.path(ctx);
      await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 });
      await expectHealthyPage(page, citizenRoute.landmark(page, ctx), problems);
    });
  }
});
