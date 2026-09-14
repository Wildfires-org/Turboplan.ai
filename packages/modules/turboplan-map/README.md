# @wildfires-org/turboplan-map

Interactive geospatial mapping for TurboPlan. Provides Leaflet/React-Leaflet map components, layer upload and management, a Hono API router, and a chat artifact for rendering maps inside conversations.

## Features

- **Interactive maps** built on Leaflet + React-Leaflet (OpenStreetMap, satellite, terrain)
- **Layer management** — upload, list, toggle visibility, delete project layers
- **Geospatial processing** — GeoJSON, KML, GPX, and shapefiles; complex formats are processed by the external map server (`packages/services/turboplan-map-server`)
- **PostGIS storage** — layer features stored as PostGIS `geometry` in the shared database (`maps` schema in `@wildfires-org/turboplan-db`)
- **Chat artifact** — map artifact for TurboPlan's artifact rendering system
- **RBAC** — routes protected with `@wildfires-org/turboplan-rbac`

## Exports

### Client (`./client`)

- Components: `BaseMapContainer` (headless core), `SimpleMap` (no layer UI), `ProjectMapViewer`, `MapContentManager`, `MapControls`, `LayerSelector`, `MapDragDropUpload`
- Hooks: `useMapLayers`, `useLayerUpload`, `useLayerStatus`, `useLayerVisibility`, `useMapFileUpload`, `useMapType`
- Utils: `analyzeLayerStatus`, `getDisplayableLayers`, `getDefaultVisibleLayers`, `getFailedLayers`, `getLayerKey`
- Artifact: `mapArtifact`
- Types: `GeospatialLayer`, `MapType`, `LayerStatus`, `MapArtifactMetadata`, and more

### Server (`./server`)

- `mapsRouter` — Hono router (mounted at `/api/maps` in `apps/server`)
- `createMapService` / `MapService`, `createMapRepository` / `DrizzleMapRepository`
- `mapDocumentHandler` — server-side artifact handler
- Types: `Layer`, `Feature`, `LayerCreationData`, `ProcessFileResult`, and more

## Usage

### Simple map

The map fills its parent container, so the parent **must** have a defined height (`h-96`, `h-screen`, `height: 400px`, …).

```tsx
import { SimpleMap } from "@wildfires-org/turboplan-map/client";

function BasicMapView() {
  return (
    <div className="h-96 w-full">
      <SimpleMap center={[40.7128, -74.006]} zoom={10} zoomControl />
    </div>
  );
}
```

`SimpleMap` also accepts `layers`, `selectedLayerId`, `visibleLayerIds`, `mapType`, `showMapTypeSelector`, `grayscale`, `zoomSnap`, and other `BaseMapContainerProps`. Use `BaseMapContainer` directly for custom UIs, or `ProjectMapViewer` for the full project map experience.

### Server-side

```typescript
import {
  createMapRepository,
  createMapService,
} from "@wildfires-org/turboplan-map/server";

const service = createMapService(createMapRepository());
```

## API Endpoints (`/api/maps`)

- `POST /layers/upload` — upload and store a processed layer (GeoJSON payload)
- `GET /layers/project/:projectId` — list layers with features for a project
- `DELETE /layers/project/:projectId` — delete all layers for a project (project `DELETE` permission)
- `DELETE /layers/:layerId` — delete a single layer
- `POST /process` — forward a file URL to the external map processing service and return processed GeoJSON

## Configuration

- Feature flag: `IS_MAPS_PACKAGE_ENABLED` / `NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED` (`isMapPackageEnabled()` from `@wildfires-org/turboplan-feature-flags`)
- `MAP_SERVICE_URL` — base URL of the external map processing service (required when maps are enabled)
- `MAP_SERVICE_API_KEY` — API key sent to the processing service as `X-API-Key`

Both are read through `@wildfires-org/turboplan-env`. Limits (max file size, feature counts, property sizes) live in `src/server/config.ts` (`MAP_SERVICE_CONFIG`).

## Related

- `packages/services/turboplan-map-server` — Python/FastAPI GIS processing service (shapefiles, geodatabases)
- `@wildfires-org/turboplan-db` — `maps` schema (layers + features, PostGIS)
