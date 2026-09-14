/**
 * Server-side exports
 * This file is the main entry point for server-side code
 */

export { mapDocumentHandler } from "./artifact/server";
export { createMapRepository, DrizzleMapRepository } from "./server/repository";
export { default as mapsRouter } from "./server/router";
// Re-export service types
export type {
  BulkFeatureResult,
  LayerCreationData,
  ProcessFileResult,
} from "./server/service";
export { createMapService, MapService } from "./server/service";
export type {
  Feature,
  GeospatialLayer,
  Layer,
  MapArtifactMetadata,
  MapRepository,
  NewFeature,
  NewLayer,
  ServerResponse,
  Session,
  Unit,
  UnitDetectionResult,
} from "./types";
