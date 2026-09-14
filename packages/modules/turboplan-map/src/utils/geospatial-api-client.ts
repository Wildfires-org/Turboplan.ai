/**
 * Geospatial API client
 * Handles communication with external geospatial processing service
 */

import { ApiClient } from "@wildfires-org/turboplan-api-client";

import type { ServerResponse } from "../types";
import { detectUnits } from "./unit-detector";

const apiClient = new ApiClient();

/**
 * Process uploaded zip file using blob URL and extract geospatial data
 * Used for files already uploaded to blob storage (from chat attachments)
 */
export async function processGeospatialFileFromUrl(
  blobUrl: string,
  fileName: string,
): Promise<ServerResponse> {
  try {
    // Send blob URL to proxy endpoint for processing
    const { data, error } = await apiClient.post<ServerResponse>(
      "/api/maps/process",
      {
        url: blobUrl,
        filename: fileName,
      },
    );

    if (error || !data) {
      throw new Error(error || "Failed to process geospatial data");
    }

    // Check if each layer is a unit layer
    const processedData = (data as ServerResponse).map((layer) => {
      if (layer.data && !layer.error) {
        const unitDetectionResult = detectUnits(layer.data);
        return {
          ...layer,
          isUnitLayer: unitDetectionResult.isUnitLayer,
        };
      }
      return {
        ...layer,
        isUnitLayer: false,
      };
    });

    return processedData;
  } catch (error) {
    console.error("Error processing geospatial file from URL:", error);
    throw new Error(
      `Failed to process geospatial data: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}
