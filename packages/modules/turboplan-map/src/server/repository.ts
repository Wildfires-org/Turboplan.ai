/**
 * Minimal Drizzle implementation of MapRepository
 */
import { eq, inArray, sql } from "drizzle-orm";

import { layers, features as mapFeatures } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import { ERROR_CODES, LAYER_TYPES } from "../constants";
import type {
  Feature,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONGeometry,
  GeospatialLayer,
  Layer,
  MapRepository,
  NewFeature,
  NewLayer,
} from "../types";
import { MAP_SERVICE_CONFIG } from "./config";

// Custom error types
export class GeospatialError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "GeospatialError";
  }
}

export class DrizzleMapRepository implements MapRepository {
  // Input validation helpers
  private validateGeometry(geometry: GeoJSONGeometry): void {
    const geometryStr = JSON.stringify(geometry);
    if (geometryStr.length > MAP_SERVICE_CONFIG.MAX_GEOMETRY_SIZE) {
      throw new GeospatialError(
        "Geometry too large",
        ERROR_CODES.GEOMETRY_TOO_LARGE,
      );
    }

    // Validate geometry type
    const validTypes = [
      "Point",
      "LineString",
      "Polygon",
      "MultiPoint",
      "MultiLineString",
      "MultiPolygon",
    ];
    if (!validTypes.includes(geometry.type)) {
      throw new GeospatialError(
        `Invalid geometry type: ${geometry.type}`,
        ERROR_CODES.INVALID_GEOMETRY_TYPE,
      );
    }

    // Validate coordinates exist
    if (!geometry.coordinates) {
      throw new GeospatialError(
        "Missing geometry coordinates",
        ERROR_CODES.MISSING_COORDINATES,
      );
    }

    // Validate coordinates are valid numbers (prevent injection via malformed coordinates)
    this.validateCoordinates(geometry.coordinates);
  }

  /**
   * Recursively validate that coordinates contain only valid numbers
   * Prevents injection attacks via malformed coordinate data
   */
  private validateCoordinates(coords: unknown): void {
    if (typeof coords === "number") {
      if (!isFinite(coords) || isNaN(coords)) {
        throw new GeospatialError(
          "Invalid coordinate value",
          ERROR_CODES.INVALID_COORDINATES,
        );
      }
      return;
    }

    if (Array.isArray(coords)) {
      for (const coord of coords) {
        this.validateCoordinates(coord);
      }
      return;
    }

    throw new GeospatialError(
      "Coordinates must be numbers or arrays",
      ERROR_CODES.INVALID_COORDINATES,
    );
  }

  /**
   * Validate and sanitize geometry JSON string before SQL insertion
   * Additional safety layer to prevent SQL injection via malformed JSON
   */
  private validateGeometryJson(geometryJson: string): void {
    try {
      // Attempt to parse JSON to ensure it's valid
      const parsed = JSON.parse(geometryJson);

      // Verify it has required GeoJSON structure
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON structure");
      }

      if (!parsed.type || !parsed.coordinates) {
        throw new Error("Missing required GeoJSON fields");
      }
    } catch (error) {
      throw new GeospatialError(
        "Invalid geometry JSON",
        ERROR_CODES.INVALID_GEOMETRY_JSON,
        { originalError: error },
      );
    }
  }

  // Layer operations - only used methods
  async createLayer(layer: NewLayer): Promise<Layer> {
    try {
      const [created] = await db.insert(layers).values(layer).returning();
      return created;
    } catch (error) {
      throw new GeospatialError(
        "Failed to create layer",
        ERROR_CODES.LAYER_CREATION_FAILED,
        { originalError: error },
      );
    }
  }

  async getLayerById(id: string): Promise<Layer | null> {
    if (!id?.trim()) {
      throw new GeospatialError(
        "Invalid layer ID",
        ERROR_CODES.INVALID_LAYER_ID,
      );
    }

    try {
      const [layer] = await db.select().from(layers).where(eq(layers.id, id));
      return layer || null;
    } catch (error) {
      throw new GeospatialError(
        "Failed to get layer",
        ERROR_CODES.LAYER_RETRIEVAL_FAILED,
        { layerId: id, originalError: error },
      );
    }
  }

  // Feature operations - only used methods
  async createFeatureWithGeometry(
    feature: NewFeature & {
      featureName?: string | null;
      featureType?: string | null;
      properties?: unknown;
    },
    geoJsonGeometry: GeoJSONGeometry,
  ): Promise<Feature> {
    if (!feature.layerId?.trim()) {
      throw new GeospatialError(
        "Invalid layer ID",
        ERROR_CODES.INVALID_LAYER_ID,
      );
    }

    this.validateGeometry(geoJsonGeometry);

    try {
      const geometryJson = JSON.stringify(geoJsonGeometry);

      // Additional validation of JSON string before SQL insertion (security)
      this.validateGeometryJson(geometryJson);

      const propertiesJson = feature.properties
        ? JSON.stringify(feature.properties)
        : null;

      const result = await db.execute(sql`
        INSERT INTO map_features (
          layer_id,
          geometry,
          feature_name,
          feature_type,
          properties
        ) VALUES (
          ${feature.layerId},
          ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
          ${feature.featureName || null},
          ${feature.featureType || null},
          ${propertiesJson}::jsonb
        )
        RETURNING *
      `);

      if (!result || result.length === 0) {
        throw new GeospatialError(
          "No feature created",
          ERROR_CODES.FEATURE_CREATION_FAILED,
        );
      }

      return result[0] as Feature;
    } catch (error) {
      if (error instanceof GeospatialError) {
        throw error;
      }
      throw new GeospatialError(
        "Failed to create feature with geometry",
        ERROR_CODES.FEATURE_GEOMETRY_CREATION_FAILED,
        { originalError: error },
      );
    }
  }

  // Batch operations - only used methods
  async createMultipleFeaturesWithGeometry(
    featuresData: Array<{ feature: NewFeature; geometry: GeoJSONGeometry }>,
  ): Promise<Feature[]> {
    if (featuresData.length === 0) return [];

    if (featuresData.length > MAP_SERVICE_CONFIG.MAX_FEATURE_COUNT) {
      throw new GeospatialError(
        `Too many features: ${featuresData.length} > ${MAP_SERVICE_CONFIG.MAX_FEATURE_COUNT}`,
        ERROR_CODES.TOO_MANY_FEATURES,
      );
    }

    const results: Feature[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Process features individually with error collection
    for (let i = 0; i < featuresData.length; i++) {
      const { feature, geometry } = featuresData[i];
      try {
        const created = await this.createFeatureWithGeometry(feature, geometry);
        results.push(created);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // If too many errors, throw
    if (errors.length > featuresData.length * 0.5) {
      throw new GeospatialError(
        "Too many feature creation failures",
        ERROR_CODES.BATCH_FAILURE_THRESHOLD_EXCEEDED,
        { errors },
      );
    }

    return results;
  }

  // Layer management operations - only used methods
  async updateLayerFeatureCount(
    id: string,
    count: number,
  ): Promise<Layer | null> {
    if (!id?.trim()) {
      throw new GeospatialError(
        "Invalid layer ID",
        ERROR_CODES.INVALID_LAYER_ID,
      );
    }

    if (count < 0 || count > MAP_SERVICE_CONFIG.MAX_FEATURE_COUNT) {
      throw new GeospatialError(
        "Invalid feature count",
        ERROR_CODES.INVALID_FEATURE_COUNT,
      );
    }

    try {
      const updateData: Partial<Layer> = { featureCount: count };

      const [updated] = await db
        .update(layers)
        .set(updateData)
        .where(eq(layers.id, id))
        .returning();
      return updated || null;
    } catch (error) {
      throw new GeospatialError(
        "Failed to update layer feature count",
        ERROR_CODES.FEATURE_COUNT_UPDATE_FAILED,
        { layerId: id, originalError: error },
      );
    }
  }

  // Get all layers for a project as GeospatialLayer format
  async getLayersWithFeaturesForProject(
    projectId: string,
  ): Promise<GeospatialLayer[]> {
    if (!projectId?.trim()) {
      throw new GeospatialError(
        "Invalid project ID",
        ERROR_CODES.INVALID_PROJECT_ID,
      );
    }

    try {
      // Get all layers for the project
      const projectLayers = await db
        .select()
        .from(layers)
        .where(eq(layers.projectId, projectId));

      if (projectLayers.length === 0) {
        return [];
      }

      // Extract all layer IDs for a single query (fixes N+1 query pattern)
      const layerIds = projectLayers.map((layer) => layer.id);

      // Fetch ALL features for ALL layers in a single query using Drizzle's query builder
      // This uses proper parameterization and avoids SQL injection
      const allFeaturesResult = await db
        .select({
          id: mapFeatures.id,
          layerId: mapFeatures.layerId,
          featureName: mapFeatures.featureName,
          featureType: mapFeatures.featureType,
          properties: mapFeatures.properties,
          geometryJson: sql<string>`ST_AsGeoJSON(${mapFeatures.geometry})::text`,
        })
        .from(mapFeatures)
        .where(inArray(mapFeatures.layerId, layerIds));

      // Group features by layer_id
      const featuresByLayerId = new Map<
        string,
        Array<{
          id: string;
          layerId: string;
          featureName: string | null;
          featureType: string | null;
          properties: unknown;
          geometryJson: string;
        }>
      >();

      for (const feature of allFeaturesResult) {
        if (!featuresByLayerId.has(feature.layerId)) {
          featuresByLayerId.set(feature.layerId, []);
        }
        featuresByLayerId.get(feature.layerId)!.push(feature);
      }

      // Build result for each layer
      const result: GeospatialLayer[] = [];

      for (const layer of projectLayers) {
        try {
          const layerFeatures = featuresByLayerId.get(layer.id) || [];

          // Convert features to GeoJSON format
          const geoJsonFeatures: GeoJSONFeature[] = layerFeatures.map(
            (feature) => {
              const geometryObj = JSON.parse(feature.geometryJson);
              return {
                type: "Feature" as const,
                geometry: {
                  type: geometryObj.type,
                  coordinates: geometryObj.coordinates,
                },
                properties: {
                  id: feature.id,
                  name: feature.featureName,
                  type: feature.featureType,
                  ...(feature.properties
                    ? (feature.properties as Record<string, unknown>)
                    : {}),
                },
              };
            },
          );

          // Create GeoJSON FeatureCollection
          const featureCollection: GeoJSONFeatureCollection = {
            type: "FeatureCollection",
            features: geoJsonFeatures,
          };

          // Create GeospatialLayer
          const geospatialLayer: GeospatialLayer = {
            id: layer.id,
            name: layer.name,
            data: geoJsonFeatures.length > 0 ? featureCollection : null,
            error: null,
            source: layer.sourceFilename,
            layer: layer.layerName,
            isUnitLayer: layer.layerType === LAYER_TYPES.UNITS_BOUNDARY,
            propertiesList: layer.propertiesList || undefined,
          };

          result.push(geospatialLayer);
        } catch (layerError) {
          // If a specific layer fails, return it with an error
          result.push({
            id: layer.id,
            name: layer.name,
            data: null,
            error:
              layerError instanceof Error
                ? layerError.message
                : "Unknown error loading layer",
            source: layer.sourceFilename,
            layer: layer.layerName,
            isUnitLayer: layer.layerType === LAYER_TYPES.UNITS_BOUNDARY,
            propertiesList: layer.propertiesList || undefined,
          });
        }
      }

      return result;
    } catch (error) {
      throw new GeospatialError(
        "Failed to get layers for project",
        ERROR_CODES.LAYERS_RETRIEVAL_FAILED,
        { projectId, originalError: error },
      );
    }
  }

  async deleteLayersForProject(projectId: string): Promise<void> {
    if (!projectId?.trim()) {
      throw new GeospatialError(
        "Invalid project ID",
        ERROR_CODES.INVALID_PROJECT_ID,
      );
    }

    await db.delete(layers).where(eq(layers.projectId, projectId));
  }

  async deleteLayerById(layerId: string): Promise<void> {
    if (!layerId?.trim()) {
      throw new GeospatialError(
        "Invalid layer ID",
        ERROR_CODES.INVALID_LAYER_ID,
      );
    }

    try {
      await db.delete(layers).where(eq(layers.id, layerId));
    } catch (error) {
      throw new GeospatialError(
        "Failed to delete layer",
        ERROR_CODES.LAYER_DELETION_FAILED,
        { layerId, originalError: error },
      );
    }
  }
}

// Factory function for creating a repository instance
export const createMapRepository = (): MapRepository => {
  return new DrizzleMapRepository();
};

// Default export for convenience
export default createMapRepository;
