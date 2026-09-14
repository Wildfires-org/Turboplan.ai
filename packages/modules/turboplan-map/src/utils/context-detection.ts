/**
 * Context detection utilities
 * Determines if user input indicates geospatial intent
 */

import { isZipFile } from "./file-validators";

/**
 * Check if user context indicates geospatial intent
 */
export function hasGeospatialContext(
  userContext?: string,
  hasZipAttachments = false,
): boolean {
  if (hasZipAttachments) return true;
  if (!userContext) return false;

  const contextLower = userContext.toLowerCase();
  const geoKeywords = [
    ".zip",
    "geospatial",
    "map",
    "geographic",
    "gis",
    "shapefile",
    "coordinates",
  ];

  return geoKeywords.some((keyword) => contextLower.includes(keyword));
}

/**
 * Find geospatial attachments (ZIP files) in attachment list
 */
export function findGeospatialAttachments(
  attachments: Array<{ url: string; name?: string; contentType?: string }>,
): Array<{ url: string; name?: string; contentType?: string }> {
  return attachments.filter((attachment) => isZipFile(attachment));
}
