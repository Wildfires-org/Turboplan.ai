// Example: Conditionally loading map features in a React component

import React, { lazy, Suspense } from "react";

import { isMapEnabled } from "@wildfires-org/turboplan-feature-flags";

// Lazy load the map attachment component only when feature is enabled
const MapComponent = lazy(() =>
  import("@wildfires-org/turboplan-map").then((module) => ({
    default: module.MapComponent,
  })),
);

export function TaskDetailExample() {
  return (
    <div>
      <h2>Task Details</h2>

      {/* Conditionally render map features */}
      {isMapEnabled() && (
        <Suspense fallback={<div>Loading map...</div>}>
          <MapComponent />
        </Suspense>
      )}
    </div>
  );
}
