"use client";

import React from "react";

import dynamic from "next/dynamic";

import type { BaseMapContainerProps } from "../../types";
import { LoadingState } from "./MapStates";

// Dynamically import the BaseMapContainer with SSR disabled
// This prevents Leaflet from trying to load on the server
export const BaseMapContainer: React.ComponentType<BaseMapContainerProps> =
  dynamic(
    () =>
      import("./BaseMapContainer").then((mod) => ({
        default: mod.BaseMapContainer,
      })),
    {
      ssr: false,
      loading: () => <LoadingState />,
    },
  );

// Re-export types
export type { BaseMapContainerProps } from "../../types";
