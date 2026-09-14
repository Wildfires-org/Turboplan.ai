/**
 * Constants for the map package
 * Centralized configuration to avoid magic strings throughout the codebase
 */

/**
 * Map type identifiers for different tile providers
 */
export const MAP_TYPES = {
  OPENSTREETMAP: "openstreetmap",
  SATELLITE: "satellite",
  TERRAIN: "terrain",
  TOPO: "topo",
} as const;

export type MapTypeId = (typeof MAP_TYPES)[keyof typeof MAP_TYPES];

/**
 * Layer type identifiers for geospatial layers
 */
export const LAYER_TYPES = {
  PROJECT_BOUNDARY: "project_boundary",
  UNITS_BOUNDARY: "units_boundary",
} as const;

export type LayerTypeId = (typeof LAYER_TYPES)[keyof typeof LAYER_TYPES];

/**
 * Error codes for geospatial operations
 */
export const ERROR_CODES = {
  // General errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PROCESSING_ERROR: "PROCESSING_ERROR",

  // Geometry errors
  GEOMETRY_TOO_LARGE: "GEOMETRY_TOO_LARGE",
  INVALID_GEOMETRY_TYPE: "INVALID_GEOMETRY_TYPE",
  INVALID_GEOMETRY_JSON: "INVALID_GEOMETRY_JSON",
  MISSING_COORDINATES: "MISSING_COORDINATES",
  INVALID_COORDINATES: "INVALID_COORDINATES",

  // Layer errors
  INVALID_LAYER_ID: "INVALID_LAYER_ID",
  LAYER_CREATION_FAILED: "LAYER_CREATION_FAILED",
  LAYER_RETRIEVAL_FAILED: "LAYER_RETRIEVAL_FAILED",
  LAYER_DELETION_FAILED: "LAYER_DELETION_FAILED",

  // Feature errors
  INVALID_FEATURE_COUNT: "INVALID_FEATURE_COUNT",
  TOO_MANY_FEATURES: "TOO_MANY_FEATURES",
  FEATURE_CREATION_FAILED: "FEATURE_CREATION_FAILED",
  FEATURE_GEOMETRY_CREATION_FAILED: "FEATURE_GEOMETRY_CREATION_FAILED",
  FEATURE_COUNT_UPDATE_FAILED: "FEATURE_COUNT_UPDATE_FAILED",
  BATCH_FAILURE_THRESHOLD_EXCEEDED: "BATCH_FAILURE_THRESHOLD_EXCEEDED",

  // Project errors
  INVALID_PROJECT_ID: "INVALID_PROJECT_ID",
  LAYERS_RETRIEVAL_FAILED: "LAYERS_RETRIEVAL_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Status values for map artifacts
 */
export const MAP_STATUS = {
  READY_TO_LOAD: "ready_to_load",
  AWAITING_UPLOAD: "awaiting_upload",
  EMPTY: "empty",
  PROCESSING: "processing",
  UPDATED: "updated",
} as const;

export type MapStatus = (typeof MAP_STATUS)[keyof typeof MAP_STATUS];
