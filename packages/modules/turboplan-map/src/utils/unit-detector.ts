/**
 * Utility functions for detecting and extracting unit information from GeoJSON features
 */
import type {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  Unit,
  UnitDetectionResult,
} from "../types";

// Re-export types for backwards compatibility
export type { Unit, UnitDetectionResult };

/**
 * Get a property value from an object in a case-insensitive way
 */
const getCaseInsensitive = (
  obj: Record<string, unknown>,
  key: string,
): unknown => {
  // Try exact match first
  if (key in obj) {
    return obj[key];
  }

  // Try case-insensitive match
  const lowerKey = key.toLowerCase();
  for (const objKey of Object.keys(obj)) {
    if (objKey.toLowerCase() === lowerKey) {
      return obj[objKey];
    }
  }

  return undefined;
};

/**
 * Check if feature properties have a unit property
 */
const hasUnitProperty = (
  featureProperties: Record<string, unknown>,
): string[] =>
  Object.keys(featureProperties).filter((key) =>
    key.toLowerCase().includes("unit"),
  );

/**
 * Find the property name for unit ID in a feature
 * Checks common property names in a case-insensitive manner
 */
const getUnitIdPropertyName = (
  feature: GeoJSONFeature,
  customPropName?: string,
): string | undefined => {
  const properties = feature.properties || {};

  // If custom property name is provided, try to find it case-insensitively
  if (customPropName) {
    const foundKey = Object.keys(properties).find(
      (key) => key.toLowerCase() === customPropName.toLowerCase(),
    );
    if (foundKey) {
      return foundKey;
    }
  }

  // Search for any property key containing "unit" (case-insensitive)
  const unitKeys = hasUnitProperty(properties);
  for (const key of unitKeys) {
    const value = properties[key];
    if (
      (typeof value === "string" && value.trim().length > 0) ||
      (typeof value === "number" && !isNaN(value) && isFinite(value))
    ) {
      return key;
    }
  }

  return undefined;
};

/**
 * Find the property name for acres in a feature
 * Checks common property names in a case-insensitive manner
 */
const getAcresPropertyName = (
  feature: GeoJSONFeature,
  customAcresPropName?: string,
): string | undefined => {
  const possiblePropertyNames = ["gis_acres", "acres"];
  const featureProperties = feature.properties || {};

  if (customAcresPropName) {
    possiblePropertyNames.unshift(customAcresPropName);
  }

  return possiblePropertyNames.find((propName) =>
    getCaseInsensitive(featureProperties, propName),
  );
};

/**
 * Check if a property value is a valid unit ID (non-empty string or number)
 */
const isValidUnitId = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number") {
    return !isNaN(value) && isFinite(value);
  }
  return false;
};

/**
 * Extract unit ID from a feature based on the unit ID key
 */
export const getUnitIdFromFeature = (
  feature: GeoJSONFeature,
  customUnitIdPropName?: string,
): string | null => {
  const featureProperties = feature.properties || {};
  const finalUnitIdPropName = getUnitIdPropertyName(
    feature,
    customUnitIdPropName,
  );

  if (!finalUnitIdPropName) {
    return null;
  }

  const value = getCaseInsensitive(featureProperties, finalUnitIdPropName);
  if (!isValidUnitId(value)) {
    return null;
  }

  return String(value).trim();
};

/**
 * Extract acres from a feature
 */
export const getAcresFromFeature = (
  feature: GeoJSONFeature,
  customAcresPropName?: string,
): number | undefined => {
  const featureProperties = feature.properties || {};
  const finalAcresPropName = getAcresPropertyName(feature, customAcresPropName);

  if (!finalAcresPropName) {
    return undefined;
  }

  const acres = Number(
    getCaseInsensitive(featureProperties, finalAcresPropName),
  );
  return isNaN(acres) ? undefined : acres;
};

/**
 * Find the property key that likely contains unit IDs
 * Returns the key if found, null otherwise
 */
export const findUnitIdKey = (feature: GeoJSONFeature): string | null => {
  return getUnitIdPropertyName(feature) || null;
};

/**
 * Find the property key that likely contains acres
 */
export const findAcresKey = (feature: GeoJSONFeature): string | null => {
  return getAcresPropertyName(feature) || null;
};

/**
 * Check if a GeoJSON is potentially a unit map
 * Returns the unit ID key if it is, null otherwise
 */
export const isPotentialUnitMap = (
  geoData: GeoJSONFeatureCollection,
): string | null => {
  if (!geoData.features || geoData.features.length === 0) {
    return null;
  }

  // Check the first few features to find unit ID and acres keys
  const samplesToCheck = Math.min(10, geoData.features.length);
  let unitIdKey: string | null = null;
  let acresKey: string | null = null;

  for (let i = 0; i < samplesToCheck; i++) {
    const feature = geoData.features[i];

    // Find unit ID key
    if (!unitIdKey) {
      unitIdKey = findUnitIdKey(feature);
    }

    // Find acres key
    if (!acresKey) {
      acresKey = findAcresKey(feature);
    }

    // If we found both, we can stop
    if (unitIdKey && acresKey) {
      break;
    }
  }

  // A unit map must have both unit IDs and acres
  if (!unitIdKey || !acresKey) {
    return null;
  }

  return unitIdKey;
};

/**
 * Extract units from GeoJSON data
 * Aggregates features by unit ID and sums their acres
 */
export const extractUnitsFromGeoJSON = (
  data: GeoJSONFeatureCollection,
  unitIdKey: string,
  unitAcresKey?: string,
): Unit[] => {
  const unitsMap = new Map<string, Unit>();

  for (const feature of data.features) {
    const unitId = getUnitIdFromFeature(feature, unitIdKey);
    const acres = getAcresFromFeature(feature, unitAcresKey);

    // Skip features without valid unit ID or acres
    if (!unitId || acres === undefined) {
      continue;
    }

    const existingUnit = unitsMap.get(unitId);

    if (existingUnit) {
      // Aggregate acres for the same unit
      existingUnit.acres += acres;
    } else {
      // Create new unit
      unitsMap.set(unitId, {
        id: unitId,
        name: unitId,
        acres,
      });
    }
  }

  return Array.from(unitsMap.values());
};

/**
 * Detect if the GeoJSON contains unit information and extract it
 */
export const detectUnits = (
  geoData: GeoJSONFeatureCollection,
): UnitDetectionResult => {
  const unitIdKey = isPotentialUnitMap(geoData);

  if (!unitIdKey) {
    return {
      isUnitLayer: false,
    };
  }

  // Find acres key from first feature
  const acresKey = findAcresKey(geoData.features[0]) || undefined;

  // Extract units
  const units = extractUnitsFromGeoJSON(geoData, unitIdKey, acresKey);

  // Only consider it a unit layer if we found at least one valid unit
  if (units.length === 0) {
    return {
      isUnitLayer: false,
    };
  }

  return {
    isUnitLayer: true,
    unitIdKey,
    unitAcresKey: acresKey,
    units,
  };
};
