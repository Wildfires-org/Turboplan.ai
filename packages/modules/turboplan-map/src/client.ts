/**
 * Client-side exports
 * This file is the main entry point for client-side code
 */

export { mapArtifact } from "./artifact/client";
export type { BaseMapContainerProps } from "./components";
export {
  BaseMapContainer,
  LayerSelector,
  MapContentManager,
  MapControls,
  MapDragDropUpload,
  ProjectMapViewer,
  SimpleMap,
} from "./components";
export { useLayerStatus } from "./hooks/use-layer-status";
export type {
  LayerUploadResult,
  UseLayerUploadOptions,
} from "./hooks/use-layer-upload";
// Hooks
export { useLayerUpload } from "./hooks/use-layer-upload";
export { useLayerVisibility } from "./hooks/use-layer-visibility";
export { useMapFileUpload } from "./hooks/use-map-file-upload";
export { useMapLayers } from "./hooks/use-map-layers";
export { useMapType } from "./hooks/use-map-type";
export type {
  GeospatialLayer,
  LAYER_COLORS,
  LayerStatus,
  MapArtifactMetadata,
  MapType,
  ProjectLayersSummary,
  ServerResponse,
  Unit,
  UnitDetectionResult,
} from "./types";
export { analyzeLayerStatus } from "./utils/layer-status";
// Utils
export {
  getDefaultVisibleLayers,
  getDisplayableLayers,
  getFailedLayers,
  getLayerKey,
} from "./utils/layer-utils";
