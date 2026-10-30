import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";
import { softDeleteProject } from "@wildfires-org/turboplan-workspace/server";

import {
  createTestProjectInOffice,
  getCitizenWorkspace,
  type WorkspaceInfo,
} from "../../utils";

/** Demo files shipped with the suite (PDF, DOCX, GeoJSON, zipped shapefiles). */
const DEMO_FIXTURES_DIR = join(process.cwd(), "fixtures", "demo-project");

export const demoFixture = (fileName: string): string => {
  return join(DEMO_FIXTURES_DIR, fileName);
};

export const shortId = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

/** Projects created in this worker, soft-deleted by `deleteTrackedProjects`. */
const trackedProjects: { id: string; ownerId: string }[] = [];

export const trackProjectForCleanup = (id: string, ownerId: string): void => {
  trackedProjects.push({ id, ownerId });
};

/**
 * Soft-delete every project tracked so far (call from `test.afterEach`). The
 * citizen's office is shared by the whole suite and its project list is
 * paginated, so leftover projects push other specs' projects off page one.
 */
export const deleteTrackedProjects = async (): Promise<void> => {
  const projects = trackedProjects.splice(0);
  for (const { id, ownerId } of projects) {
    await softDeleteProject(id, ownerId);
  }
};

export type CitizenProject = {
  workspace: WorkspaceInfo;
  id: string;
  name: string;
  slug: string;
  /** `/:org/:office/:project` */
  path: string;
};

/**
 * A fresh project in the citizen's personal office, created through the
 * workspace service (no UI, no AI) and owned by the citizen. Each spec gets its
 * own so parallel agents and workers never share state.
 */
export const createCitizenProject = async (
  label: string,
): Promise<CitizenProject> => {
  const workspace = await getCitizenWorkspace();
  const created = await createTestProjectInOffice({
    name: `${label} ${shortId()}`,
    description: `E2E project for ${label}`,
    officeId: workspace.officeId,
    createdBy: workspace.userId,
  });
  trackProjectForCleanup(created.id, workspace.userId);

  return {
    workspace,
    ...created,
    path: appPaths.project(
      workspace.orgSlug,
      workspace.officeSlug,
      created.slug,
    ),
  };
};

/** The project row as stored, read straight from the database. */
export const getProjectRowByName = async (name: string) => {
  const rows = await db.select().from(project).where(eq(project.name, name));
  return rows[0] ?? null;
};

/**
 * Whether a feature module is on for this run. Mirrors
 * `@wildfires-org/turboplan-feature-flags` (only the literal "true", any case,
 * under either the plain or the NEXT_PUBLIC_ name). The suite starts the
 * servers from the same `.env` the specs load, so both sides agree.
 */
export const isModuleEnabled = (flag: string): boolean => {
  return [process.env[flag], process.env[`NEXT_PUBLIC_${flag}`]].some(
    (value) => value?.trim().toLowerCase() === "true",
  );
};

/**
 * Answer the browser's direct PUT to the presigned R2 URL with a 200.
 *
 * Uploads go browser -> R2 straight from the page, so they depend on the
 * bucket's CORS rules allowing the app's origin; the shared test bucket does
 * not allow http://localhost:3000 and the PUT fails with a CORS error. Only
 * that external hop is faked: presigning and registering the file with the API
 * (the part these specs check) still run for real. The stored object does not
 * exist, so nothing here may open or download the file.
 */
export const mockStorageUpload = async (page: Page): Promise<void> => {
  await page.route(/\.r2\.cloudflarestorage\.com\//, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "PUT, OPTIONS",
        "access-control-allow-headers": "*",
        etag: '"e2e-mocked-upload"',
      },
      body: "",
    });
  });
};

/**
 * Stand in for the Python map service behind `POST /api/maps/process`, which
 * the suite does not start: answer with the GeoJSON file's own features as one
 * layer named `layerName`. Saving the layer (`POST /api/maps/layers/upload`)
 * and everything after it is real.
 */
export const mockMapProcessing = async (
  page: Page,
  { filePath, layerName }: { filePath: string; layerName: string },
): Promise<void> => {
  const geoData = JSON.parse(readFileSync(filePath, "utf-8"));
  const sourceFileName = filePath.split("/").pop() ?? layerName;

  await page.route("**/api/maps/process", async (route) => {
    const origin = route.request().headers().origin ?? "*";
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "*",
    };

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      json: [
        {
          name: layerName,
          layer: layerName,
          source: sourceFileName,
          data: geoData,
          error: null,
        },
      ],
    });
  });
};
