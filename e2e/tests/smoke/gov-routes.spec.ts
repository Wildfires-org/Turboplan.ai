import { expect, type Locator, type Page, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";
import { createProject } from "@wildfires-org/turboplan-workspace/server";

import { GOV_WORKSPACE, OFFICE_URL_PATTERN } from "../../config";
import {
  createTestProjectChat,
  createTestProjectInOffice,
  getGovWorkspace,
  getTestGovernmentOrganization,
} from "../../utils";
import {
  ABORTED_BY_DASHBOARD_REDIRECT,
  expectHealthyPage,
  expectNotFoundPage,
  type FeaturePackage,
  isPackageEnabled,
  mainHeading,
  watchPageProblems,
} from "./route-health";

/**
 * Route smoke: every dashboard page under `app/(dashboard)` (plus the other
 * signed-in pages) opens for the gov user, the owner of the GOVERNMENT
 * organization and its office, without an error page or browser errors.
 *
 * The spec adds its own project, template and chat to the gov office, so it
 * never depends on, or changes, the project created during auth setup.
 */
test.use({ storageState: "./storage/auth/gov.json" });

// One worker builds the fixtures once; tests still run (and fail) on their own.
test.describe.configure({ mode: "default" });

type SmokeContext = {
  orgSlug: string;
  orgName: string;
  officeSlug: string;
  officeName: string;
  project: { slug: string; name: string };
  template: { slug: string; name: string };
  chat: { id: string; title: string };
};

type SmokeRoute = {
  /** The route as it appears under `app/`, used as the test title. */
  route: string;
  path: (ctx: SmokeContext) => string;
  /** The heading or landmark that proves the page's own content rendered. */
  landmark: (page: Page, ctx: SmokeContext) => Locator;
  /**
   * Where the route lands when it redirects. Defaults to `path`. Redirects
   * inside the dashboard also set `allowedConsoleErrors`.
   */
  expectedUrl?: (ctx: SmokeContext) => string | RegExp;
  allowedConsoleErrors?: RegExp[];
  /**
   * The page belongs to an optional package. While the package is disabled the
   * route must answer with the not-found page, as billing and org context do.
   */
  featurePackage?: FeaturePackage;
};

const shortId = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

const org = (ctx: SmokeContext): string => {
  return appPaths.organization(ctx.orgSlug);
};

const office = (ctx: SmokeContext): string => {
  return appPaths.office(ctx.orgSlug, ctx.officeSlug);
};

const project = (ctx: SmokeContext): string => {
  return appPaths.project(ctx.orgSlug, ctx.officeSlug, ctx.project.slug);
};

const orgHeading = (page: Page, ctx: SmokeContext): Locator => {
  return mainHeading(page, ctx.orgName);
};

const officeHeading = (page: Page, ctx: SmokeContext): Locator => {
  return mainHeading(page, ctx.officeName);
};

const projectHeading = (page: Page, ctx: SmokeContext): Locator => {
  return mainHeading(page, ctx.project.name);
};

const anyMainHeading = (page: Page): Locator => {
  return page.getByRole("heading", { level: 1 }).first();
};

const ROUTES: SmokeRoute[] = [
  {
    route: "/",
    path: () => "/",
    landmark: anyMainHeading,
    // The root page resolves the user's landing office and redirects there.
    expectedUrl: () => OFFICE_URL_PATTERN,
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
    route: "/setup/personal",
    path: () => "/setup/personal",
    landmark: anyMainHeading,
    // Onboarding is finished, so the setup layout sends the user home.
    expectedUrl: () => OFFICE_URL_PATTERN,
  },
  {
    route: "/setup/plan",
    path: () => "/setup/plan",
    landmark: anyMainHeading,
    expectedUrl: () => OFFICE_URL_PATTERN,
  },
  {
    route: "/[orgSlug]",
    path: org,
    landmark: orgHeading,
  },
  {
    route: "/[orgSlug]/members",
    path: (ctx) => `${org(ctx)}/members`,
    landmark: orgHeading,
  },
  {
    route: "/[orgSlug]/my-signatures",
    path: (ctx) => `${org(ctx)}/my-signatures`,
    landmark: orgHeading,
    featurePackage: "SIGNING",
  },
  {
    route: "/[orgSlug]/billing",
    path: (ctx) => `${org(ctx)}/billing`,
    landmark: orgHeading,
    featurePackage: "BILLING",
  },
  {
    route: "/[orgSlug]/context",
    path: (ctx) => `${org(ctx)}/context`,
    landmark: orgHeading,
    featurePackage: "PROJECT_CONTEXT",
  },
  {
    route: "/[orgSlug]/[officeSlug]",
    path: office,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/members",
    path: (ctx) => `${office(ctx)}/members`,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/citizen-submissions",
    path: (ctx) => `${office(ctx)}/citizen-submissions`,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/my-submissions",
    path: (ctx) => `${office(ctx)}/my-submissions`,
    landmark: officeHeading,
    // Citizen-only: everyone else is sent to the office page.
    expectedUrl: office,
    allowedConsoleErrors: ABORTED_BY_DASHBOARD_REDIRECT,
  },
  {
    route: "/[orgSlug]/[officeSlug]/templates",
    path: (ctx) => `${office(ctx)}/templates`,
    landmark: officeHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/templates/document",
    path: (ctx) => `${office(ctx)}/templates/document`,
    landmark: (page) => mainHeading(page, "Document Templates"),
  },
  {
    route: "/[orgSlug]/[officeSlug]/templates/[templateSlug]",
    path: (ctx) => `${office(ctx)}/templates/${ctx.template.slug}`,
    landmark: (page, ctx) => mainHeading(page, ctx.template.name),
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]",
    path: project,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/overview",
    path: (ctx) => `${project(ctx)}/overview`,
    landmark: projectHeading,
    // Kept for old links; the overview is the project page itself.
    expectedUrl: project,
    allowedConsoleErrors: ABORTED_BY_DASHBOARD_REDIRECT,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/chat",
    path: (ctx) => `${project(ctx)}/chat`,
    landmark: (page) => mainHeading(page, "New Chat"),
    // No initial chat yet, so it opens a new one.
    expectedUrl: (ctx) => `${project(ctx)}/chats/new`,
    allowedConsoleErrors: ABORTED_BY_DASHBOARD_REDIRECT,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/chats/new",
    path: (ctx) => `${project(ctx)}/chats/new`,
    landmark: (page) => mainHeading(page, "New Chat"),
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/chats/[chatId]",
    path: (ctx) => `${project(ctx)}/chats/${ctx.chat.id}`,
    landmark: (page, ctx) => mainHeading(page, ctx.chat.title),
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/map",
    path: (ctx) => `${project(ctx)}/map`,
    // The map fills the page under the header; it has no page heading.
    landmark: (page) =>
      page
        .getByRole("navigation", { name: "Breadcrumb" })
        .getByText("Map", { exact: true }),
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/tasks",
    path: (ctx) => `${project(ctx)}/tasks`,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/timeline",
    path: (ctx) => `${project(ctx)}/timeline`,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/comments",
    path: (ctx) => `${project(ctx)}/comments`,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/documents",
    path: (ctx) => `${project(ctx)}/documents`,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/members",
    path: (ctx) => `${project(ctx)}/members`,
    landmark: projectHeading,
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/signing",
    path: (ctx) => `${project(ctx)}/signing`,
    landmark: projectHeading,
    featurePackage: "SIGNING",
  },
  {
    route: "/[orgSlug]/[officeSlug]/[projectSlug]/context",
    path: (ctx) => `${project(ctx)}/context`,
    // Documents and GIS layers live here too, so the page renders with the
    // project-context package off; only its notes section is hidden.
    landmark: projectHeading,
  },
];

test.describe("Route smoke - gov owner", () => {
  let ctx: SmokeContext;

  test.beforeAll(async () => {
    const workspace = await getGovWorkspace();
    const govOrg = await getTestGovernmentOrganization(workspace.userId);
    if (!govOrg) {
      throw new Error("Gov GOVERNMENT organization not found");
    }

    const smokeProject = await createTestProjectInOffice({
      name: `Smoke Project ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });

    const templateName = `Smoke Template ${shortId()}`;
    const template = await createProject({
      name: templateName,
      slug: templateName.toLowerCase().replace(/\s+/g, "-"),
      officeId: workspace.officeId,
      createdBy: workspace.userId,
      isTemplate: true,
    });

    const chat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: smokeProject.id,
      title: `Smoke Chat ${shortId()}`,
    });

    ctx = {
      orgSlug: workspace.orgSlug,
      orgName: govOrg.name,
      officeSlug: workspace.officeSlug,
      officeName: GOV_WORKSPACE.OFFICE_NAME,
      project: { slug: smokeProject.slug, name: smokeProject.name },
      template: { slug: template.slug, name: template.name },
      chat,
    };
  });

  for (const smokeRoute of ROUTES) {
    test(smokeRoute.route, async ({ page }) => {
      const isDisabledPackage =
        smokeRoute.featurePackage !== undefined &&
        !isPackageEnabled(smokeRoute.featurePackage);

      const problems = watchPageProblems(page, smokeRoute.allowedConsoleErrors);
      await page.goto(smokeRoute.path(ctx));

      if (isDisabledPackage) {
        await expectNotFoundPage(page, problems);
        return;
      }

      const expectedUrl = smokeRoute.expectedUrl?.(ctx) ?? smokeRoute.path(ctx);
      await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 });
      await expectHealthyPage(page, smokeRoute.landmark(page, ctx), problems);
    });
  }
});
