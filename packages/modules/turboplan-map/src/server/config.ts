/**
 * Configuration constants for map service
 * Centralized configuration allows easy tuning for different environments
 */

export const MAP_SERVICE_CONFIG = {
  /** Maximum number of features allowed in a single layer */
  MAX_FEATURE_COUNT: 100000,

  /** Number of features to process in a single batch */
  MAX_FEATURE_BATCH_SIZE: 1000,

  /** Maximum file size for uploads (100MB) */
  MAX_FILE_SIZE: 100 * 1024 * 1024,

  /** Maximum size for properties JSON (1MB) */
  MAX_PROPERTIES_SIZE: 1024 * 1024,

  /** Maximum number of property keys per feature */
  MAX_PROPERTY_KEYS: 100,

  /** Maximum length for property keys */
  MAX_PROPERTY_KEY_LENGTH: 100,

  /** Maximum length for string values in properties */
  MAX_STRING_VALUE_LENGTH: 10000,

  /** Maximum nesting depth for properties objects */
  MAX_PROPERTIES_DEPTH: 3,

  /** Supported file types for upload */
  SUPPORTED_FILE_TYPES: ["geojson", "kml", "gpx", "shapefile"] as const,

  /** Maximum length for layer names */
  MAX_LAYER_NAME_LENGTH: 255,

  /** Maximum length for filenames */
  MAX_FILENAME_LENGTH: 255,

  /** Maximum geometry size (50MB) */
  MAX_GEOMETRY_SIZE: 50 * 1024 * 1024,
} as const;

/**
 * Type for file types supported by the system
 */
export type SupportedFileType =
  (typeof MAP_SERVICE_CONFIG.SUPPORTED_FILE_TYPES)[number];
