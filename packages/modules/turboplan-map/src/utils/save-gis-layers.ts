/**
 * Save GIS layers straight to a project's map, without the layer-picker
 * dialog. Used wherever a dropped GIS ZIP should "just work" (project chat,
 * project context dropzone).
 */

import { mutate } from "swr";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

import type { GeospatialLayer, ServerResponse } from "../types";
import { detectUnits } from "./unit-detector";

export type GisZipSaveResult = {
  /** Layers saved to the project map */
  added: number;
  /** Layers already in the project (same name, source and feature count) */
  skipped: number;
  /** Layers unreadable in the ZIP or rejected by the save endpoint */
  failed: number;
  /** Names of the layers that were added */
  layerNames: string[];
  /** One readable message per failed layer */
  errors: string[];
};

type ProcessAndSaveGisZipParams = {
  projectId: string;
  /** URL of the ZIP already uploaded to storage */
  url: string;
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

const getFeatureCount = (layer: GeospatialLayer): number =>
  layer.data?.features.length ?? 0;

const getDedupeKey = (layer: GeospatialLayer): string =>
  `${layer.name}\u0000${layer.source}\u0000${getFeatureCount(layer)}`;

const toUploadPayload = (
  layer: GeospatialLayer & { data: NonNullable<GeospatialLayer["data"]> },
): LayerUploadPayload => ({
  name: layer.name,
  layerName: layer.layer,
  sourceFilename: layer.source,
  fileType: "geojson",
  geoData: layer.data,
});

const hasData = (
  layer: GeospatialLayer,
): layer is GeospatialLayer & {
  data: NonNullable<GeospatialLayer["data"]>;
} => !layer.error && Boolean(layer.data);

// Best-effort: when the lookup fails every layer is saved.
const getExistingLayerKeys = async (projectId: string) => {
  const { data } = await apiClient.get<GeospatialLayer[]>(
    getProjectLayersKey(projectId),
  );
  return new Set((data ?? []).map(getDedupeKey));
};

/**
 * Save every readable layer to the project map. Layers that look like
 * management units (see `detectUnits`) are saved as the units layer, all
 * others as project layers. Never throws for per-layer problems — they are
 * counted in `failed` / `errors`.
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
  };

  for (const layer of layers) {
    if (!hasData(layer)) {
      result.failed += 1;
      result.errors.push(layer.error || `${layer.name}: no data to display`);
    }
  }

  const readableLayers = layers.filter(hasData);
  if (readableLayers.length === 0) {
    return result;
  }

  const existingKeys = await getExistingLayerKeys(projectId);

  for (const layer of readableLayers) {
    if (existingKeys.has(getDedupeKey(layer))) {
      result.skipped += 1;
      continue;
    }

    const unitDetection = detectUnits(layer.data);
    const payload = toUploadPayload(layer);
    const { error } = await apiClient.post("/api/maps/layers/upload", {
      projectId,
      projectLayer: unitDetection.isUnitLayer ? null : payload,
      unitLayer: unitDetection.isUnitLayer ? payload : null,
      unitIdKey: unitDetection.isUnitLayer
        ? unitDetection.unitIdKey
        : undefined,
    });

    if (error) {
      result.failed += 1;
      result.errors.push(`${layer.name}: ${error}`);
      continue;
    }

    existingKeys.add(getDedupeKey(layer));
    result.added += 1;
    result.layerNames.push(layer.name);
  }

  if (result.added > 0) {
    await mutate(getProjectLayersKey(projectId));
  }

  return result;
};

/**
 * Process an uploaded GIS ZIP with the map service and save its layers to the
 * project map. Throws with the service's message when the ZIP cannot be
 * processed or contains no readable layer.
 */
export const processAndSaveGisZip = async ({
  projectId,
  url,
  fileName,
}: ProcessAndSaveGisZipParams): Promise<GisZipSaveResult> => {
  const { data: layers, error } = await apiClient.post<ServerResponse>(
    "/api/maps/process",
    { url, filename: fileName },
  );

  if (error || !layers) {
    throw new Error(error || `Could not process ${fileName}`);
  }

  if (!layers.some(hasData)) {
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
