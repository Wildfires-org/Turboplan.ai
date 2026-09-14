/**
 * Utility for parsing map artifact content
 * Follows Single Responsibility Principle
 */

import type { ServerResponse } from "../types";

export interface ParsedMapContent {
  layers: ServerResponse;
  message?: string;
  status?: string;
  blobUrl?: string;
  fileName?: string;
  projectId?: string;
}

export function parseMapContent(content: string): ParsedMapContent | null {
  if (!content) return null;

  try {
    const parsedContent = JSON.parse(content);

    // New format with blob URL (lighter content)
    if (parsedContent.blobUrl || parsedContent.status) {
      return {
        layers: [], // Will be loaded from blob URL
        message: parsedContent.message,
        status: parsedContent.status,
        blobUrl: parsedContent.blobUrl,
        fileName: parsedContent.fileName,
      };
    }

    // Legacy format with full layers data (for backward compatibility)
    if (parsedContent.layers && Array.isArray(parsedContent.layers)) {
      return {
        layers: parsedContent.layers,
        message: parsedContent.message,
        status: parsedContent.status,
      };
    }
  } catch (error) {
    // Content is not JSON, return null
    console.error("Error parsing map content:", error);
  }

  return null;
}
