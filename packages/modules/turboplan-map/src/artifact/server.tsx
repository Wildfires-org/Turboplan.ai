import { MAP_STATUS } from "../constants";
import type {
  CreateDocumentCallbackProps,
  UpdateDocumentCallbackProps,
} from "../types/server";
import {
  findGeospatialAttachments,
  hasGeospatialContext,
} from "../utils/context-detection";

// ============================================================================
// MAIN DOCUMENT HANDLER
// ============================================================================

export const mapDocumentHandler = {
  kind: "map" as const,

  /**
   * Create new map document - processes uploaded geospatial data
   */
  onCreateDocument: async ({
    id: documentId,
    title,
    userContext,
    writer,
    session,
    projectId,
    attachments = [],
  }: CreateDocumentCallbackProps) => {
    if (!session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    try {
      // Process attachments for map creation
      const zipAttachments = findGeospatialAttachments(attachments);
      const hasGeoContext = hasGeospatialContext(
        userContext,
        zipAttachments.length > 0,
      );

      if (zipAttachments.length > 0) {
        // Process the first ZIP file
        const zipFile = zipAttachments[0];

        // Don't process the file here - just save blob URL for later loading
        writer.write({ type: "data-artifact", data: { type: "map-delta" } });

        // Save only blob URL - processing will happen when user opens the artifact
        return JSON.stringify({
          blobUrl: zipFile.url,
          fileName: zipFile.name,
          message: `Map artifact created. Data will load when opened.`,
          status: MAP_STATUS.READY_TO_LOAD,
          projectId,
        });
      } else if (hasGeoContext) {
        // Create placeholder for manual upload
        writer.write({ type: "data-artifact", data: { type: "map-delta" } });

        return JSON.stringify({
          blobUrl: null,
          fileName: null,
          message:
            "Map artifact created. Upload a ZIP file containing geospatial data.",
          status: MAP_STATUS.AWAITING_UPLOAD,
          projectId,
        });
      } else {
        // Create empty map artifact
        writer.write({ type: "data-artifact", data: { type: "map-delta" } });

        return JSON.stringify({
          blobUrl: null,
          fileName: null,
          message: "Empty map created. Upload geospatial data to display.",
          status: MAP_STATUS.EMPTY,
          projectId,
        });
      }
    } catch (error) {
      console.error("Error creating map:", error);
      throw error;
    }
  },

  /**
   * Update map document - can process new files or modify display settings
   */
  onUpdateDocument: async ({
    description,
    writer,
    session,
  }: UpdateDocumentCallbackProps) => {
    // Process update request
    if (!session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    try {
      // Check if this is a file upload update
      const isFileUpdate =
        description.toLowerCase().includes("upload") ||
        description.toLowerCase().includes("file") ||
        description.toLowerCase().includes(".zip");

      if (isFileUpdate) {
        // In a real implementation, we would:
        // 1. Extract the uploaded file from the request/context
        // 2. Process it through the geospatial API
        // 3. Return the processed layers

        // For now, return a processing message
        writer.write({ type: "data-artifact", data: { type: "map-delta" } });

        return JSON.stringify({
          blobUrl: null,
          fileName: null,
          message:
            "File processing initiated. Results will appear when processing completes.",
          status: MAP_STATUS.PROCESSING,
        });
      } else {
        // Handle other types of updates (layer selection, map type changes, etc.)
        writer.write({ type: "data-artifact", data: { type: "map-delta" } });

        return JSON.stringify({
          blobUrl: null,
          fileName: null,
          message: "Map settings updated.",
          status: MAP_STATUS.UPDATED,
        });
      }
    } catch (error) {
      console.error("Error updating map:", error);
      throw error;
    }
  },
};
