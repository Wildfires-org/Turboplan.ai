/**
 * Save GIS layers straight to a project's map, without the layer-picker
 * dialog. Used wherever a dropped GIS file (ZIP, KMZ, KML, GeoJSON or
 * GeoPackage) should "just work" (project chat, project context dropzone).
 */

import { mutate } from "swr";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

import type { LayerUploadResult } from "../hooks/use-layer-upload";
import type { GeospatialLayer, ServerResponse } from "../types";
import { hasMapFeatures } from "./layer-utils";
import { detectUnits } from "./unit-detector";

export type GisZipSaveResult = {
  /** Layers saved to the project map */
  added: number;
  /** Layers already in the project (same name and source file) */
  skipped: number;
  /** Layers unreadable in the file or rejected by the save endpoint */
  failed: number;
  /** Names of the layers that were added */
  layerNames: string[];
  /** One readable message per failed layer */
  errors: string[];
  /**
   * Names of the skipped layers; `formatSkippedLayersMessage` turns them
   * into a message that says how to replace them
   */
  skippedLayerNames?: string[];
  /** Notes from the save endpoint, e.g. features it could not save */
  warnings?: string[];
};

type ProcessAndSaveGisFileParams = {
  projectId: string;
  /** URL of the GIS file (ZIP, KMZ, KML, GeoJSON, GeoPackage) already in storage */
  url: string;
  /** Original file name; names the layers and hints the format */
  fileName: string;
};

type LayerUploadPayload = {
  name: string;
  layerName: string;
  sourceFilename: string;
  fileType: "geojson";
  geoData: NonNullable<GeospatialLayer["data"]>;
};

const apiClient = new ApiClient();

const getProjectLayersKey = (projectId: string) =>
  `/api/maps/layers/project/${projectId}`;

const toUploadPayload = (
  layer: GeospatialLayer & { data: NonNullable<GeospatialLayer["data"]> },
): LayerUploadPayload => ({
  name: layer.name,
  layerName: layer.layer,
  sourceFilename: layer.source,
  fileType: "geojson",
  geoData: layer.data,
});

/**
 * Save every readable layer to the project map. The first layer that looks
 * like management units (see `detectUnits`) is saved as the units layer, all
 * others as project layers; the server keeps a project to one units layer and
 * skips layers the project already has. Never throws for per-layer problems —
 * they are counted in `failed` / `errors`.
 */
export const saveGisLayersToProject = async (
  projectId: string,
  layers: GeospatialLayer[],
): Promise<GisZipSaveResult> => {
  const result: GisZipSaveResult = {
    added: 0,
    skipped: 0,
    failed: 0,
    layerNames: [],
    errors: [],
    skippedLayerNames: [],
    warnings: [],
  };

  for (const layer of layers) {
    if (layer.error) {
      result.failed += 1;
      result.errors.push(layer.error);
    }
  }

  let hasUnitLayer = false;

  // A layer without features (e.g. an empty KML folder) has nothing to save:
  // the save endpoint rejects it, so it is neither saved nor reported.
  for (const layer of layers.filter(hasMapFeatures)) {
    const unitDetection = detectUnits(layer.data);
    const isUnitLayer = unitDetection.isUnitLayer && !hasUnitLayer;
    const payload = toUploadPayload(layer);
    const { data, error } = await apiClient.post<LayerUploadResult>(
      "/api/maps/layers/upload",
      {
        projectId,
        projectLayer: isUnitLayer ? null : payload,
        unitLayer: isUnitLayer ? payload : null,
        unitIdKey: isUnitLayer ? unitDetection.unitIdKey : undefined,
      },
    );

    if (error || !data) {
      result.failed += 1;
      result.errors.push(`${layer.name}: ${error || "could not be saved"}`);
      continue;
    }

    const savedLayers = data.layers ?? [];
    const skippedLayers = data.skippedLayers ?? [];
    result.warnings?.push(...(data.warnings ?? []));

    if (savedLayers.length === 0 && skippedLayers.length === 0) {
      result.failed += 1;
      result.errors.push(`${layer.name}: could not be saved`);
      continue;
    }

    if (isUnitLayer) {
      hasUnitLayer = true;
    }
    result.skipped += skippedLayers.length;
    result.skippedLayerNames?.push(...skippedLayers);
    result.added += savedLayers.length;
    result.layerNames.push(...savedLayers.map((saved) => saved.name));
  }

  if (result.added > 0) {
    await mutate(getProjectLayersKey(projectId));
  }

  return result;
};

/**
 * Process an uploaded GIS file with the map service and save its layers to
 * the project map. Throws with the service's message when the file cannot be
 * processed or contains no readable layer.
 */
export const processAndSaveGisFile = async ({
  projectId,
  url,
  fileName,
}: ProcessAndSaveGisFileParams): Promise<GisZipSaveResult> => {
  const { data: layers, error } = await apiClient.post<ServerResponse>(
    "/api/maps/process",
    { url, filename: fileName },
  );

  if (error || !layers) {
    throw new Error(error || `Could not process ${fileName}`);
  }

  if (!layers.some(hasMapFeatures)) {
    const reasons = layers
      .map((layer) => layer.error)
      .filter((reason): reason is string => Boolean(reason));
    throw new Error(
      reasons.length > 0
        ? reasons.join(" ")
        : `No readable GIS layers found in ${fileName}`,
    );
  }

  return saveGisLayersToProject(projectId, layers);
};
