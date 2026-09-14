import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react";

import type { LucideIcon } from "lucide-react";

import type {
  Feature,
  Layer,
  NewFeature,
  NewLayer,
} from "@wildfires-org/turboplan-db";

// Import types that we need for proper typing
export type DataStreamDelta = {
  type:
    | "text-delta"
    | "code-delta"
    | "sheet-delta"
    | "image-delta"
    | "map-delta"
    | "title"
    | "id"
    | "suggestion"
    | "clear"
    | "finish"
    | "kind";
  content: string | Suggestion;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

// GeoJSON coordinate types based on RFC 7946
type Position = [number, number] | [number, number, number];

// Geometry coordinate types
type PointCoordinates = Position;
type LineStringCoordinates = Position[];
type PolygonCoordinates = Position[][];
type MultiPointCoordinates = Position[];
type MultiLineStringCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

// Union type for all coordinate types
export type GeoJSONCoordinates =
  | PointCoordinates
  | LineStringCoordinates
  | PolygonCoordinates
  | MultiPointCoordinates
  | MultiLineStringCoordinates
  | MultiPolygonCoordinates;

// GeoJSON geometry types
export type GeoJSONGeometryType =
  | "Point"
  | "LineString"
  | "Polygon"
  | "MultiPoint"
  | "MultiLineString"
  | "MultiPolygon";

// GeoJSON geometry object
export interface GeoJSONGeometry {
  type: GeoJSONGeometryType;
  coordinates: GeoJSONCoordinates;
}

// GeoJSON types
export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: GeoJSONGeometryType;
    coordinates: GeoJSONCoordinates;
  };
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Geospatial layer types
export interface GeospatialLayer {
  id?: string; // Database layer ID for deletion and updates
  name: string;
  data: GeoJSONFeatureCollection | null;
  error: string | null;
  source: string;
  layer: string;
  isUnitLayer?: boolean;
  propertiesList?: string[]; // List of property keys available in this layer
}

export type ServerResponse = GeospatialLayer[];

// Map type definitions
export interface MapType {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  icon: LucideIcon;
}

// Map container component props
export interface BaseMapContainerProps {
  /** Map type (e.g., 'openstreetmap', 'satellite', etc.) */
  mapType?: string;
  /** Callback when map type changes */
  onMapTypeChange?: (mapType: MapType) => void;
  /** Whether to show the map type selector */
  showMapTypeSelector?: boolean;
  /** Whether to show the layer visibility selector */
  showLayerSelector?: boolean;
  /** Callback when layer visibility is toggled */
  onToggleLayer?: (layerId: string) => void;
  /** Custom className for the container */
  className?: string;
  /** Center coordinates [latitude, longitude] */
  center?: [number, number];
  /** Initial zoom level */
  zoom?: number;
  /** Whether to show zoom controls */
  zoomControl?: boolean;
  /** Zoom snap increment for smooth zooming */
  zoomSnap?: number;
  /** Layers to display on the map */
  layers?: GeospatialLayer[];
  /** ID of the selected layer to display (legacy - use visibleLayerIds for multi-layer support) */
  selectedLayerId?: string | null;
  /** Set of layer IDs that should be visible (supports multiple layers) */
  visibleLayerIds?: Set<string>;
  /** Custom message when no data is available */
  emptyMessage?: string;
  /** Custom title when no data is available */
  emptyTitle?: string;
  /** Apply grayscale filter to map tiles */
  grayscale?: boolean;
  /** Property key to use for feature labels */
  labelPropertyKey?: string;
  /** Optional color mapping for layers */
  layerColors?: Record<string, string>;
}

// Unit detection and management types
export interface Unit {
  id: string;
  name: string;
  acres: number;
}

export interface UnitDetectionResult {
  isUnitLayer: boolean;
  unitIdKey?: string;
  unitAcresKey?: string;
  units?: Unit[];
}

// Layer colors for visualization
export const LAYER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FECA57", // Yellow
  "#FF9FF3", // Pink
  "#54A0FF", // Light Blue
  "#5F27CD", // Purple
  "#00D2D3", // Cyan
  "#FF9F43", // Orange
  "#10AC84", // Emerald
  "#EE5A24", // Orange Red
  "#0984E3", // Dark Blue
  "#6C5CE7", // Violet
  "#A29BFE", // Light Purple
] as const;

export type LayerColor = (typeof LAYER_COLORS)[number];

// Layer selection item for UI components
export interface LayerSelectionItem {
  id: string;
  name: string;
  source: string;
  visible: boolean;
  hasError: boolean;
  featureCount: number;
}

// Artifact-related types
export interface InitializeParameters<M = unknown> {
  documentId?: string;
  setMetadata: Dispatch<SetStateAction<M>>;
}

export interface RestoreParameters<M = unknown> {
  documentId: string;
  content: string;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

export type MapArtifactKind = "map";

export interface ArtifactContent<M = unknown> {
  documentId?: string;
  title?: string;
  content: string;
  mode?: "edit" | "diff";
  isCurrentVersion: boolean;
  currentVersionIndex?: number;
  status?: "streaming" | "idle";
  suggestions?: Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline?: boolean;
  getDocumentContentById?: (index: number) => string;
  isLoading?: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
  onUpdate?: () => void;
  projectId?: string;
}

export type ArtifactActionContext<M = unknown> = {
  content: string;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
};

export type ArtifactAction<M = unknown> = {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

// Import type from @ai-sdk/react when available
export type ArtifactToolbarContext = {
  appendMessage: (message: { role: "user"; content: string }) => Promise<void>;
};

export type ArtifactToolbarItem = {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactToolbarContext) => void;
};

export type ArtifactConfig<T extends string, M = unknown> = {
  kind: T;
  description: string;
  content: ComponentType<ArtifactContent<M>>;
  actions: Array<ArtifactAction<M>>;
  toolbar: ArtifactToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onRestore?: (parameters: RestoreParameters<M>) => Promise<void> | void;
  // Using a flexible function signature to work with any UIArtifact type from the consumer
  onStreamPart: <A>(args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: (updater: A | ((current: A) => A)) => void;
    streamPart: DataStreamDelta;
  }) => void;
};

export interface MapArtifactMetadata {
  projectId?: string;
  layers?: ServerResponse;
  selectedLayerId?: string | null;
  selectedMapType?: string;
  isLoading?: boolean;
}

// Session type for server-side use
export interface Session {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Repository interfaces
export interface MapRepository {
  // Layer operations
  createLayer(layer: NewLayer): Promise<Layer>;
  getLayerById(id: string): Promise<Layer | null>;

  // Feature operations
  createFeatureWithGeometry(
    feature: NewFeature & {
      featureName?: string | null;
      featureType?: string | null;
      properties?: unknown;
    },
    geoJsonGeometry: GeoJSONGeometry,
  ): Promise<Feature>;
  createMultipleFeaturesWithGeometry(
    featuresData: Array<{
      feature: NewFeature & {
        featureName?: string | null;
        featureType?: string | null;
        properties?: unknown;
      };
      geometry: GeoJSONGeometry;
    }>,
  ): Promise<Feature[]>;

  // Layer management operations
  updateLayerFeatureCount(id: string, count: number): Promise<Layer | null>;
  getLayersWithFeaturesForProject(
    projectId: string,
  ): Promise<GeospatialLayer[]>;
  deleteLayersForProject(projectId: string): Promise<void>;
  deleteLayerById(layerId: string): Promise<void>;
}

// Layer status types for UI
export interface LayerStatus {
  type: "project_boundary" | "units_boundary";
  exists: boolean;
  layerId?: string;
  name?: string;
  featureCount?: number;
}

export interface ProjectLayersSummary {
  projectBoundary: LayerStatus;
  unitsBoundary: LayerStatus;
  hasAnyLayers: boolean;
}

// Re-export database types for convenience
export type { Layer, NewLayer, Feature, NewFeature };

export class Artifact<T extends string, M = unknown> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ArtifactContent<M>>;
  readonly actions: Array<ArtifactAction<M>>;
  readonly toolbar: ArtifactToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters<M>) => void;
  readonly onRestore?: (
    parameters: RestoreParameters<M>,
  ) => Promise<void> | void;
  readonly onStreamPart: <A>(args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: (updater: A | ((current: A) => A)) => void;
    streamPart: DataStreamDelta;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions || [];
    this.toolbar = config.toolbar || [];
    this.initialize = config.initialize || (async () => ({}));
    this.onRestore = config.onRestore;
    this.onStreamPart = config.onStreamPart;
  }
}
