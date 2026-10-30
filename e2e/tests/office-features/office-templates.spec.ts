import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "@wildfires-org/turboplan-db/db-client";
import { project } from "@wildfires-org/turboplan-db/schemas";
import { createOffice } from "@wildfires-org/turboplan-workspace/server";

import { appPaths, PROJECT_URL_PATTERN } from "../../config";
import { OfficeFeaturesTemplatesPage } from "../../pages/office-features-templates";
import {
  createTestOrganization,
  createTestProjectInOffice,
  getGovWorkspace,
  type TestOrganization,
} from "../../utils";

/**
 * Office templates UI: the templates grid, a template's page and the
 * "Create template from project" action on a project page.
 *
 * Runs as the gov user in a fresh BUSINESS organization it owns, with a new
 * office per test, so the grid only ever holds that test's templates (other
 * specs and agents share the gov user's GOVERNMENT office). The API side of
 * create-from-template is covered in tests/api/create-from-template.spec.ts.
 */

const shortId = (): string => Math.random().toString(36).substring(2, 8);

type TestOffice = { id: string; slug: string };

const getProjectRow = async (projectId: string) => {
  const [row] = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return row;
};

test.describe("Office templates", () => {
  test.use({ storageState: "./storage/auth/gov.json" });
  test.setTimeout(60_000);

  let ownerId: string;
  let organization: TestOrganization;

  test.beforeAll(async () => {
    const govWorkspace = await getGovWorkspace();
    ownerId = govWorkspace.userId;
    organization = await createTestOrganization({
      ownerId,
      name: `E2E Templates Org ${shortId()}`,
    });
  });

  const createTestOffice = async (): Promise<TestOffice> => {
    const office = await createOffice({
      name: `Templates Office ${shortId()}`,
      organizationId: organization.id,
      createdBy: ownerId,
    });
    return { id: office.id, slug: office.slug };
  };

  /** Seed a template (a project row flagged isTemplate) in `office` */
  const seedTemplate = async (
    office: TestOffice,
    name: string,
    description = "Seeded template",
  ) => {
    const template = await createTestProjectInOffice({
      name,
      description,
      officeId: office.id,
      createdBy: ownerId,
    });
    await db
      .update(project)
      .set({ isTemplate: true })
      .where(eq(project.id, template.id));
    return template;
  };

  test("an office without templates shows the empty state", async ({
    page,
  }) => {
    const office = await createTestOffice();
    const templates = new OfficeFeaturesTemplatesPage(page);

    await templates.gotoGrid(organization.slug, office.slug);
    await templates.expectEmptyState();
  });

  test("creates a template from a project via the project menu", async ({
    page,
  }) => {
    const office = await createTestOffice();
    const source = await createTestProjectInOffice({
      name: `Culvert Source ${shortId()}`,
      description: "Source project for a template",
      officeId: office.id,
      createdBy: ownerId,
    });
    const templateName = `Culvert Template ${shortId()}`;
    const templates = new OfficeFeaturesTemplatesPage(page);

    await page.goto(
      appPaths.project(organization.slug, office.slug, source.slug),
    );
    await templates.createTemplateFromProjectPage({
      sourceProjectName: source.name,
      templateName,
    });

    // Persisted: a template row copied from the source project.
    await expect
      .poll(async () => {
        const rows = await db
          .select()
          .from(project)
          .where(
            and(
              eq(project.officeId, office.id),
              eq(project.name, templateName),
            ),
          );
        return rows.map((row) => ({
          isTemplate: row.isTemplate,
          parentProjectId: row.parentProjectId,
        }));
      })
      .toEqual([{ isTemplate: true, parentProjectId: source.id }]);

    // And listed on a freshly loaded templates grid.
    await templates.gotoGrid(organization.slug, office.slug);
    await expect(templates.getTemplateCard(templateName)).toBeVisible({
      timeout: 15000,
    });
    // The source project stays a regular project.
    expect((await getProjectRow(source.id)).isTemplate).toBe(false);
  });

  test("edits a template's name and description from its page", async ({
    page,
  }) => {
    const office = await createTestOffice();
    const template = await seedTemplate(
      office,
      `Bioswale Template ${shortId()}`,
    );
    const newName = `Bioswale Renamed ${shortId()}`;
    const newDescription = `Updated description ${shortId()}`;
    const templates = new OfficeFeaturesTemplatesPage(page);

    await templates.gotoTemplate(organization.slug, office.slug, template.slug);
    await expect(templates.getTemplatePageTitle()).toContainText(template.name);

    await templates.editFromTemplatePage({
      name: newName,
      description: newDescription,
    });

    await expect
      .poll(async () => {
        const row = await getProjectRow(template.id);
        return { name: row.name, description: row.description };
      })
      .toEqual({ name: newName, description: newDescription });

    // A rename can change the slug; reopen the template by its current one.
    const { slug } = await getProjectRow(template.id);
    await templates.gotoTemplate(organization.slug, office.slug, slug);
    await expect(templates.getTemplatePageTitle()).toContainText(newName);
    await expect(page.getByText(newDescription)).toBeVisible();
  });

  test("renames a template from the templates grid", async ({ page }) => {
    const office = await createTestOffice();
    const template = await seedTemplate(
      office,
      `Drainage Template ${shortId()}`,
    );
    const newName = `Drainage Renamed ${shortId()}`;
    const templates = new OfficeFeaturesTemplatesPage(page);

    await templates.gotoGrid(organization.slug, office.slug);
    await expect(templates.getTemplateCard(template.name)).toBeVisible({
      timeout: 15000,
    });
    await templates.renameFromGrid(template.name, newName);

    await expect
      .poll(async () => (await getProjectRow(template.id)).name)
      .toBe(newName);

    await templates.gotoGrid(organization.slug, office.slug);
    await expect(templates.getTemplateCard(newName)).toBeVisible({
      timeout: 15000,
    });
    await expect(templates.getTemplateCard(template.name)).toHaveCount(0);
  });

  test("deletes a template from the templates grid", async ({ page }) => {
    const office = await createTestOffice();
    const template = await seedTemplate(office, `Repave Template ${shortId()}`);
    const templates = new OfficeFeaturesTemplatesPage(page);

    await templates.gotoGrid(organization.slug, office.slug);
    await expect(templates.getTemplateCard(template.name)).toBeVisible({
      timeout: 15000,
    });
    await templates.deleteFromGrid(template.name);

    // Persisted: the row is gone or soft-deleted.
    await expect
      .poll(async () => {
        const row = await getProjectRow(template.id);
        return !row || row.deletedAt !== null;
      })
      .toBe(true);

    await templates.gotoGrid(organization.slug, office.slug);
    await templates.expectEmptyState();
  });

  test("creates a project from a template via Use Template", async ({
    page,
  }) => {
    const office = await createTestOffice();
    const template = await seedTemplate(
      office,
      `Wildlife Crossing Template ${shortId()}`,
      "Template for wildlife crossings",
    );
    const projectName = `Wildlife Crossing ${shortId()}`;
    const templates = new OfficeFeaturesTemplatesPage(page);

    await templates.gotoTemplate(organization.slug, office.slug, template.slug);
    await expect(templates.getTemplatePageTitle()).toContainText(template.name);
    await templates.useTemplate(projectName);

    await page.waitForURL(
      (url) =>
        PROJECT_URL_PATTERN.test(url.href) &&
        !url.pathname.includes("/templates/"),
      { timeout: 20000 },
    );

    // Persisted: a regular project in this office, derived from the template.
    const [created] = await db
      .select()
      .from(project)
      .where(
        and(eq(project.officeId, office.id), eq(project.name, projectName)),
      );
    expect(created).toBeDefined();
    expect(created.isTemplate).toBe(false);
    expect(created.parentProjectId).toBe(template.id);
    expect(created.description).toBe("Template for wildlife crossings");
    expect(new URL(page.url()).pathname).toBe(
      appPaths.project(organization.slug, office.slug, created.slug),
    );

    // The new project's page renders after a reload.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      projectName,
    );

    // The template itself is untouched and still listed.
    expect((await getProjectRow(template.id)).isTemplate).toBe(true);
    await templates.gotoGrid(organization.slug, office.slug);
    await expect(templates.getTemplateCard(template.name)).toBeVisible({
      timeout: 15000,
    });
    await expect(templates.getTemplateCard(projectName)).toHaveCount(0);
  });

  test("the document templates page shows its coming-soon state", async ({
    page,
  }) => {
    const office = await createTestOffice();

    await page.goto(
      `${appPaths.office(organization.slug, office.slug)}/templates/document`,
    );

    await expect(
      page.getByRole("heading", { name: "Document Templates", level: 1 }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Document Templates Coming Soon" }),
    ).toBeVisible();
  });
});
