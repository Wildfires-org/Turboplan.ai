/**
 * Map Service - Business logic layer for geospatial data processing
 *
 * This service handles the validation, processing, and persistence of geospatial layers
 * including both project boundaries and unit boundaries. It provides comprehensive
 * validation at multiple levels (file, layer, feature, properties) to ensure data integrity.
 *
 * Key Responsibilities:
 * - Validate file uploads (size, type, structure)
 * - Process GeoJSON data and extract metadata
 * - Detect and configure unit layers automatically
 * - Batch process features for performance
 * - Provide detailed error reporting and warnings
 *
 * Security Features:
 * - Input sanitization for SQL injection prevention
 * - Properties validation (size, depth, key names)
 * - Geometry validation and coordinate verification
 * - File size and feature count limits
 *
 * Configuration:
 * All limits and constants are defined in ./config.ts for easy adjustment
 *
 * @see MAP_SERVICE_CONFIG in ./config.ts for configurable limits
 */
import { ERROR_CODES, LAYER_TYPES } from "../constants";
import type {
  Feature,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONGeometry,
  Layer,
  MapRepository,
  NewFeature,
  NewLayer,
} from "../types";
import { detectUnits } from "../utils/unit-detector";
import { MAP_SERVICE_CONFIG, type SupportedFileType } from "./config";

export interface ProcessFileResult {
  success: boolean;
  layer?: Layer;
  layers?: Layer[];
  error?: string;
  warnings?: string[];
}

export interface LayerCreationData {
  projectId: string;
  name: string;
  layerName: string;
  sourceFilename: string;
  fileType: string;
  geoData?: GeoJSONFeatureCollection;
}

export interface IndividualLayerData {
  name: string;
  layerName: string;
  sourceFilename: string;
  fileType: string;
  geoData?: GeoJSONFeatureCollection;
}

export interface LayersCreationData {
  projectId: string;
  projectLayer: IndividualLayerData | null;
  unitLayer: IndividualLayerData | null;
  unitIdKey?: string;
}

export interface BulkFeatureResult {
  created: Feature[];
  failed: Array<{ feature: GeoJSONFeature; error: string }>;
  totalProcessed: number;
}

// Custom error types
export class MapServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "MapServiceError";
  }
}

export class ValidationError extends MapServiceError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.VALIDATION_ERROR, details);
    this.name = "ValidationError";
  }
}

export class ProcessingError extends MapServiceError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.PROCESSING_ERROR, details);
    this.name = "ProcessingError";
  }
}

export class MapService {
  constructor(private readonly mapRepository: MapRepository) {}

  /**
   * Extract unique property names from GeoJSON features
   */
  private extractPropertiesList(geoData: GeoJSONFeatureCollection): string[] {
    const propertiesSet = new Set<string>();

    for (const feature of geoData.features) {
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) =>
          propertiesSet.add(key),
        );
      }
    }

    return Array.from(propertiesSet).sort();
  }

  /**
   * Validate properties object for security and size constraints
   * Prevents XSS, injection attacks, and excessive data storage
   */
  private validateProperties(properties: unknown): {
    isValid: boolean;
    error?: string;
  } {
    // Allow null/undefined properties
    if (properties === null || properties === undefined) {
      return { isValid: true };
    }

    // Must be an object
    if (typeof properties !== "object" || Array.isArray(properties)) {
      return { isValid: false, error: "Properties must be an object" };
    }

    // Check JSON size
    const propertiesJson = JSON.stringify(properties);
    if (propertiesJson.length > MAP_SERVICE_CONFIG.MAX_PROPERTIES_SIZE) {
      return {
        isValid: false,
        error: `Properties too large: ${Math.round(
          propertiesJson.length / 1024,
        )}KB (max ${Math.round(MAP_SERVICE_CONFIG.MAX_PROPERTIES_SIZE / 1024)}KB)`,
      };
    }

    // Check number of keys
    const keys = Object.keys(properties);
    if (keys.length > MAP_SERVICE_CONFIG.MAX_PROPERTY_KEYS) {
      return {
        isValid: false,
        error: `Too many property keys: ${keys.length} (max ${MAP_SERVICE_CONFIG.MAX_PROPERTY_KEYS})`,
      };
    }

    // Validate key names (alphanumeric, underscore, hyphen, dot only)
    const keyPattern = /^[a-zA-Z0-9_.-]+$/;
    for (const key of keys) {
      if (!keyPattern.test(key)) {
        return {
          isValid: false,
          error: `Invalid property key: "${key}". Keys must contain only letters, numbers, underscore, hyphen, and dot.`,
        };
      }

      // Limit key length
      if (key.length > MAP_SERVICE_CONFIG.MAX_PROPERTY_KEY_LENGTH) {
        return {
          isValid: false,
          error: `Property key too long: "${key.substring(0, 20)}..." (max ${MAP_SERVICE_CONFIG.MAX_PROPERTY_KEY_LENGTH} characters)`,
        };
      }
    }

    // Check nesting depth
    const checkDepth = (obj: unknown, depth: number): boolean => {
      if (depth > MAP_SERVICE_CONFIG.MAX_PROPERTIES_DEPTH) {
        return false;
      }
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const value of Object.values(obj)) {
          if (!checkDepth(value, depth + 1)) {
            return false;
          }
        }
      }
      return true;
    };

    if (!checkDepth(properties, 1)) {
      return {
        isValid: false,
        error: `Properties nested too deeply (max ${MAP_SERVICE_CONFIG.MAX_PROPERTIES_DEPTH} levels)`,
      };
    }

    // Validate string values for excessive length (prevent storage issues)
    const checkStringLengths = (obj: unknown): string | null => {
      if (
        typeof obj === "string" &&
        obj.length > MAP_SERVICE_CONFIG.MAX_STRING_VALUE_LENGTH
      ) {
        return `String value too long: ${obj.length} characters (max ${MAP_SERVICE_CONFIG.MAX_STRING_VALUE_LENGTH})`;
      }
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const value of Object.values(obj)) {
          const error = checkStringLengths(value);
          if (error) return error;
        }
      }
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const error = checkStringLengths(item);
          if (error) return error;
        }
      }
      return null;
    };

    const stringError = checkStringLengths(properties);
    if (stringError) {
      return { isValid: false, error: stringError };
    }

    return { isValid: true };
  }

  // New method that accepts separate project and unit layers
  async createLayersFromFiles(
    data: LayersCreationData,
  ): Promise<ProcessFileResult> {
    try {
      const createdLayers: Layer[] = [];
      const warnings: string[] = [];

      // Validate at least one layer is provided
      if (!data.projectLayer && !data.unitLayer) {
        return {
          success: false,
          error:
            "At least one layer (projectLayer or unitLayer) must be provided",
        };
      }

      // Validate project layer if provided
      if (data.projectLayer) {
        const projectLayerValidation = this.validateLayerData({
          projectId: data.projectId,
          name: data.projectLayer.name,
          layerName: data.projectLayer.layerName,
          sourceFilename: data.projectLayer.sourceFilename,
          fileType: data.projectLayer.fileType,
          geoData: data.projectLayer.geoData,
        });

        if (!projectLayerValidation.isValid) {
          return {
            success: false,
            error: `Project layer validation failed: ${projectLayerValidation.error}`,
          };
        }

        // Validate GeoJSON for project layer if provided
        if (data.projectLayer.geoData) {
          const geoValidation = this.validateGeoJSONData(
            data.projectLayer.geoData,
          );
          if (!geoValidation.isValid) {
            return {
              success: false,
              error: `Project layer GeoJSON validation failed: ${geoValidation.error}`,
            };
          }
        }
      }

      // Validate unit layer if provided
      if (data.unitLayer) {
        const unitLayerValidation = this.validateLayerData({
          projectId: data.projectId,
          name: data.unitLayer.name,
          layerName: data.unitLayer.layerName,
          sourceFilename: data.unitLayer.sourceFilename,
          fileType: data.unitLayer.fileType,
          geoData: data.unitLayer.geoData,
        });

        if (!unitLayerValidation.isValid) {
          return {
            success: false,
            error: `Unit layer validation failed: ${unitLayerValidation.error}`,
          };
        }

        // Validate GeoJSON for unit layer if provided
        if (data.unitLayer.geoData) {
          const geoValidation = this.validateGeoJSONData(
            data.unitLayer.geoData,
          );
          if (!geoValidation.isValid) {
            return {
              success: false,
              error: `Unit layer GeoJSON validation failed: ${geoValidation.error}`,
            };
          }
        }
      }

      // Create project boundary layer if provided
      if (data.projectLayer) {
        // Extract properties list from project layer GeoJSON features
        const projectPropertiesList = data.projectLayer.geoData
          ? this.extractPropertiesList(data.projectLayer.geoData)
          : [];

        // Create project boundary layer
        const projectBoundaryLayer = {
          projectId: data.projectId,
          name: this.sanitizeString(
            data.projectLayer.name,
            MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH,
          ),
          layerName: this.sanitizeString(
            data.projectLayer.layerName,
            MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH,
          ),
          sourceFilename: this.sanitizeString(
            data.projectLayer.sourceFilename,
            MAP_SERVICE_CONFIG.MAX_FILENAME_LENGTH,
          ),
          fileType: data.projectLayer.fileType.toLowerCase(),
          layerType: LAYER_TYPES.PROJECT_BOUNDARY,
          propertiesList:
            projectPropertiesList.length > 0
              ? projectPropertiesList
              : undefined,
        } as NewLayer;

        const createdProjectLayer =
          await this.mapRepository.createLayer(projectBoundaryLayer);

        // Process geospatial data for project boundary
        if (data.projectLayer.geoData) {
          const featureResult = await this.processGeoJSONFeatures(
            createdProjectLayer.id,
            data.projectLayer.geoData,
          );

          // Update layer feature count
          await this.mapRepository.updateLayerFeatureCount(
            createdProjectLayer.id,
            featureResult.created.length,
          );

          if (featureResult.failed.length > 0) {
            warnings.push(
              `${featureResult.failed.length} features failed to process in project boundary`,
            );
          }
        }

        const updatedProjectLayer = await this.mapRepository.getLayerById(
          createdProjectLayer.id,
        );

        if (updatedProjectLayer) {
          createdLayers.push(updatedProjectLayer);
        }
      }

      // Create units boundary layer if unit layer data provided
      if (data.unitLayer && data.unitLayer.geoData) {
        // Detect units in the unit layer
        const unitDetection = detectUnits(data.unitLayer.geoData);

        // Use custom unitIdKey if provided, otherwise use auto-detected key
        const effectiveUnitIdKey = data.unitIdKey || unitDetection?.unitIdKey;

        if (!unitDetection?.isUnitLayer && !data.unitIdKey) {
          warnings.push(
            "Unit layer provided but no unit information detected. Skipping unit layer creation.",
          );
        } else {
          // Extract properties list from unit layer GeoJSON features
          const unitPropertiesList = this.extractPropertiesList(
            data.unitLayer.geoData,
          );

          const unitsBoundaryLayer = {
            projectId: data.projectId,
            name: this.sanitizeString(
              data.unitLayer.name,
              MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH,
            ),
            layerName: this.sanitizeString(
              data.unitLayer.layerName,
              MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH,
            ),
            sourceFilename: this.sanitizeString(
              data.unitLayer.sourceFilename,
              MAP_SERVICE_CONFIG.MAX_FILENAME_LENGTH,
            ),
            fileType: data.unitLayer.fileType.toLowerCase(),
            layerType: LAYER_TYPES.UNITS_BOUNDARY,
            unitIdKey: effectiveUnitIdKey,
            unitAcresKey: unitDetection?.unitAcresKey,
            propertiesList:
              unitPropertiesList.length > 0 ? unitPropertiesList : undefined,
          } as NewLayer;

          const createdUnitsLayer =
            await this.mapRepository.createLayer(unitsBoundaryLayer);

          // Process geospatial data for units boundary with custom unitIdKey
          const featureResult = await this.processGeoJSONFeatures(
            createdUnitsLayer.id,
            data.unitLayer.geoData,
            effectiveUnitIdKey,
          );

          // Update layer feature count
          await this.mapRepository.updateLayerFeatureCount(
            createdUnitsLayer.id,
            featureResult.created.length,
          );

          if (featureResult.failed.length > 0) {
            warnings.push(
              `${featureResult.failed.length} features failed to process in units boundary`,
            );
          }

          const updatedUnitsLayer = await this.mapRepository.getLayerById(
            createdUnitsLayer.id,
          );

          if (updatedUnitsLayer) {
            createdLayers.push(updatedUnitsLayer);
          }
        }
      }

      return {
        success: true,
        layers: createdLayers,
        layer: createdLayers[0], // For backward compatibility
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Feature operations
  private async processGeoJSONFeatures(
    layerId: string,
    geoData: GeoJSONFeatureCollection,
    unitIdKey?: string,
  ): Promise<BulkFeatureResult> {
    if (!layerId?.trim()) {
      throw new ValidationError("Invalid layer ID");
    }

    const validation = this.validateGeoJSONData(geoData);
    if (!validation.isValid) {
      throw new ValidationError(validation.error || "Invalid GeoJSON data");
    }

    const created: Feature[] = [];
    const failed: Array<{ feature: GeoJSONFeature; error: string }> = [];

    // Process features in batches to avoid memory issues
    const features = geoData.features;
    const batchSize = Math.min(
      MAP_SERVICE_CONFIG.MAX_FEATURE_BATCH_SIZE,
      features.length,
    );

    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      const batchResult = await this.processBatch(layerId, batch, unitIdKey);

      created.push(...batchResult.created);
      failed.push(...batchResult.failed);
    }

    return {
      created,
      failed,
      totalProcessed: geoData.features.length,
    };
  }

  private async processBatch(
    layerId: string,
    features: GeoJSONFeature[],
    unitIdKey?: string,
  ): Promise<BulkFeatureResult> {
    const created: Feature[] = [];
    const failed: Array<{ feature: GeoJSONFeature; error: string }> = [];

    // Prepare features for batch creation with geometry
    const featuresWithGeometry: Array<{
      feature: NewFeature;
      geometry: GeoJSONGeometry;
    }> = [];

    for (const feature of features) {
      try {
        // Validate individual feature
        this.validateGeoJSONFeature(feature);

        // Validate properties for security (size, structure, content)
        if (feature.properties) {
          const propertiesValidation = this.validateProperties(
            feature.properties,
          );
          if (!propertiesValidation.isValid) {
            throw new ValidationError(
              propertiesValidation.error || "Invalid properties",
            );
          }
        }

        // Extract feature name and type from properties
        const featureName = this.extractFeatureName(feature, unitIdKey);
        const featureType = feature.geometry.type;

        const newFeature: NewFeature & {
          featureName?: string | null;
          featureType?: string | null;
          properties?: Record<string, unknown>;
        } = {
          layerId,
          ...(featureName && {
            featureName: this.sanitizeString(featureName, 255),
          }),
          ...(featureType && {
            featureType: this.sanitizeString(featureType, 100),
          }),
          ...(feature.properties && {
            properties: feature.properties,
          }),
        };

        featuresWithGeometry.push({
          feature: newFeature,
          geometry: feature.geometry,
        });
      } catch (error) {
        failed.push({
          feature,
          error: this.getErrorMessage(error),
        });
      }
    }

    // Create features in batch with geometry
    if (featuresWithGeometry.length > 0) {
      try {
        const batchCreated =
          await this.mapRepository.createMultipleFeaturesWithGeometry(
            featuresWithGeometry,
          );
        created.push(...batchCreated);
      } catch (batchError) {
        // Log batch creation failure for debugging and monitoring
        console.error(
          "Batch feature creation failed, falling back to individual creation",
          {
            layerId,
            featureCount: featuresWithGeometry.length,
            error: this.getErrorMessage(batchError),
            errorCode:
              batchError instanceof MapServiceError
                ? batchError.code
                : "UNKNOWN",
          },
        );

        // If batch creation fails, fall back to individual creation
        for (let i = 0; i < featuresWithGeometry.length; i++) {
          try {
            const createdFeature =
              await this.mapRepository.createFeatureWithGeometry(
                featuresWithGeometry[i].feature,
                featuresWithGeometry[i].geometry,
              );
            created.push(createdFeature);
          } catch (individualError) {
            failed.push({
              feature: features[i],
              error: this.getErrorMessage(individualError),
            });
          }
        }
      }
    }

    return { created, failed, totalProcessed: features.length };
  }

  // Private validation methods
  private validateLayerData(data: LayerCreationData): {
    isValid: boolean;
    error?: string;
  } {
    if (!data.projectId?.trim()) {
      return { isValid: false, error: "Project ID is required" };
    }

    if (!data.name?.trim()) {
      return { isValid: false, error: "Layer name is required" };
    }

    if (data.name.length > MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH) {
      return {
        isValid: false,
        error: `Layer name too long (max ${MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH} characters)`,
      };
    }

    if (!data.layerName?.trim()) {
      return { isValid: false, error: "Layer name is required" };
    }

    if (data.layerName.length > MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH) {
      return {
        isValid: false,
        error: `Layer name too long (max ${MAP_SERVICE_CONFIG.MAX_LAYER_NAME_LENGTH} characters)`,
      };
    }

    if (!data.sourceFilename?.trim()) {
      return { isValid: false, error: "Source filename is required" };
    }

    if (data.sourceFilename.length > MAP_SERVICE_CONFIG.MAX_FILENAME_LENGTH) {
      return {
        isValid: false,
        error: `Filename too long (max ${MAP_SERVICE_CONFIG.MAX_FILENAME_LENGTH} characters)`,
      };
    }

    if (!data.fileType?.trim()) {
      return { isValid: false, error: "File type is required" };
    }

    // Validate file type
    if (
      !MAP_SERVICE_CONFIG.SUPPORTED_FILE_TYPES.includes(
        data.fileType.toLowerCase() as SupportedFileType,
      )
    ) {
      return {
        isValid: false,
        error: `Unsupported file type: ${
          data.fileType
        }. Supported types: ${MAP_SERVICE_CONFIG.SUPPORTED_FILE_TYPES.join(", ")}`,
      };
    }

    return { isValid: true };
  }

  private validateGeoJSONData(geoData: GeoJSONFeatureCollection): {
    isValid: boolean;
    error?: string;
  } {
    if (!geoData || typeof geoData !== "object") {
      return { isValid: false, error: "Invalid GeoJSON data" };
    }

    if (geoData.type !== "FeatureCollection") {
      return { isValid: false, error: "GeoJSON must be a FeatureCollection" };
    }

    if (!Array.isArray(geoData.features)) {
      return { isValid: false, error: "GeoJSON features must be an array" };
    }

    if (geoData.features.length === 0) {
      return {
        isValid: false,
        error: "GeoJSON must contain at least one feature",
      };
    }

    if (geoData.features.length > MAP_SERVICE_CONFIG.MAX_FEATURE_COUNT) {
      return {
        isValid: false,
        error: `Too many features: ${geoData.features.length} (max ${MAP_SERVICE_CONFIG.MAX_FEATURE_COUNT})`,
      };
    }

    // Estimate data size
    const dataSize = JSON.stringify(geoData).length;
    if (dataSize > MAP_SERVICE_CONFIG.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `GeoJSON data too large: ${Math.round(
          dataSize / 1024 / 1024,
        )}MB (max ${Math.round(MAP_SERVICE_CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB)`,
      };
    }

    return { isValid: true };
  }

  private validateGeoJSONFeature(feature: GeoJSONFeature): void {
    if (!feature || typeof feature !== "object") {
      throw new ValidationError("Invalid feature object");
    }

    if (feature.type !== "Feature") {
      throw new ValidationError('Feature must have type "Feature"');
    }

    if (!feature.geometry || typeof feature.geometry !== "object") {
      throw new ValidationError("Feature must have geometry");
    }

    if (!feature.geometry.type) {
      throw new ValidationError("Feature geometry must have type");
    }

    const validGeometryTypes = [
      "Point",
      "LineString",
      "Polygon",
      "MultiPoint",
      "MultiLineString",
      "MultiPolygon",
    ];

    if (!validGeometryTypes.includes(feature.geometry.type)) {
      throw new ValidationError(
        `Invalid geometry type: ${feature.geometry.type}`,
      );
    }

    if (!feature.geometry.coordinates) {
      throw new ValidationError("Feature geometry must have coordinates");
    }
  }

  // Private helper methods
  private extractFeatureName(
    feature: GeoJSONFeature,
    unitIdKey?: string,
  ): string | null {
    // If a specific unitIdKey is provided, use it first
    if (unitIdKey && feature.properties?.[unitIdKey]) {
      const value = String(feature.properties[unitIdKey]).trim();
      if (value) {
        return value;
      }
    }

    // Fall back to trying common name properties
    const nameProps = ["name", "title", "label", "description", "id"];

    for (const prop of nameProps) {
      if (feature.properties?.[prop]) {
        const value = String(feature.properties[prop]).trim();
        if (value) {
          return value;
        }
      }
    }

    return null;
  }

  private sanitizeString(input: string, maxLength: number): string {
    if (!input || typeof input !== "string") {
      return "";
    }

    // Remove potentially dangerous characters and trim
    const sanitized = input
      .replace(/[<>\"']/g, "") // Remove HTML/SQL injection chars
      .trim();

    // Truncate if too long
    return sanitized.length > maxLength
      ? sanitized.substring(0, maxLength).trim()
      : sanitized;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred";
  }
}

// Factory function for creating a service instance
export const createMapService = (repository: MapRepository): MapService => {
  return new MapService(repository);
};

// Default export for convenience
export default createMapService;
