import { expect, test } from "@playwright/test";

import { ProjectContextPage } from "../../pages/project-context";
import { ProjectMapPage } from "../../pages/project-map";
import { TurboplanProjectPage } from "../../pages/turboplan-project";
import {
  createCitizenProject,
  deleteTrackedProjects,
  demoFixture,
  mockMapProcessing,
  mockStorageUpload,
  shortId,
} from "./project-helpers";

const GEOJSON_FILE = "jackson-creek-survey-points.geojson";
/** Point features in the fixture. */
const GEOJSON_FEATURE_COUNT = 5;

/**
 * The project Map page. GIS files are added from the Context page's dropzone;
 * the Python map service that converts them is not part of the suite, so its
 * endpoint is mocked (see `mockMapProcessing`). Saving and reading the layer
 * are real.
 */
test.describe("Project map", () => {
  test.afterEach(async () => {
    await deleteTrackedProjects();
  });

  test("a GeoJSON dropped on the project shows as a layer on the map", async ({
    page,
  }) => {
    test.setTimeout(90000);

    const project = await createCitizenProject("Map Layer");
    const layerName = `Survey Points ${shortId()}`;
    const filePath = demoFixture(GEOJSON_FILE);
    await mockStorageUpload(page);
    await mockMapProcessing(page, { filePath, layerName });

    const contextPage = new ProjectContextPage(page);
    await contextPage.goto(project.path);
    await contextPage.dropFile(filePath);
    await expect(
      contextPage.main.getByText(/1 layer added to the map/),
    ).toBeVisible({ timeout: 30000 });
    await expect(contextPage.removeLayerButton(layerName)).toBeVisible();

    // The layer is stored: it is on the map after a fresh load.
    const mapPage = new ProjectMapPage(page);
    await mapPage.goto(project.path);
    const layerToggle = await mapPage.openLayerToggle(layerName);
    await expect(layerToggle).toBeChecked();
    await expect(mapPage.renderedFeatures).toHaveCount(GEOJSON_FEATURE_COUNT);

    // And listed with its feature count on the Context page.
    await contextPage.goto(project.path);
    await expect(
      contextPage.main.getByText(
        `${GEOJSON_FEATURE_COUNT} features · ${GEOJSON_FILE}`,
      ),
    ).toBeVisible({ timeout: 15000 });
  });

  test("an empty map loads with a link back to the project", async ({
    page,
  }) => {
    const project = await createCitizenProject("Map Empty");
    const mapPage = new ProjectMapPage(page);

    await mapPage.goto(project.path);
    await expect(mapPage.backToProjectLink).toBeVisible();
    await expect(mapPage.renderedFeatures).toHaveCount(0);
  });

  test("the empty map's Back to project link opens the project", async ({
    page,
  }) => {
    const project = await createCitizenProject("Map Back");
    const mapPage = new ProjectMapPage(page);

    await mapPage.goto(project.path);
    await mapPage.backToProjectLink.click();

    await expect(page).toHaveURL(new RegExp(`${project.path}$`), {
      timeout: 10000,
    });
    await new TurboplanProjectPage(page).expectHeading(project.name);
  });
});
