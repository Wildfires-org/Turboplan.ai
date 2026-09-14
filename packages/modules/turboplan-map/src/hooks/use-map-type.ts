"use client";

import { useCallback, useState } from "react";

import type { MapType } from "../types";

interface UseMapTypeResult {
  selectedMapType: MapType | string;
  handleMapTypeChange: (mapType: MapType) => void;
}

export function useMapType(
  initialMapType: MapType | string = "openstreetmap",
): UseMapTypeResult {
  const [selectedMapType, setSelectedMapType] = useState<MapType | string>(
    initialMapType,
  );

  const handleMapTypeChange = useCallback((mapType: MapType) => {
    setSelectedMapType(mapType);
  }, []);

  return {
    selectedMapType,
    handleMapTypeChange,
  };
}
