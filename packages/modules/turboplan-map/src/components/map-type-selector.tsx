/**
 * Map Type Selector component for switching between different map layers
 */

"use client";

import React, { useState } from "react";

import { Check, Globe, Mountain, Satellite } from "lucide-react";

import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ZINDEX,
} from "@wildfires-org/turboplan-utils";

import type { MapType } from "../types";

export const MAP_TYPES: MapType[] = [
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    icon: Globe,
  },
  {
    id: "satellite",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '© <a href="https://www.esri.com/">Esri</a>, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
    maxZoom: 17,
    icon: Satellite,
  },
  {
    id: "terrain",
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    icon: Mountain,
  },
];

interface MapTypeSelectorProps {
  selectedMapType: string;
  onMapTypeChange: (mapType: MapType) => void;
}

/** Round glass map control (36px), shared by the map overlay buttons. */
export const MAP_CONTROL_BUTTON_CLASS =
  "flex size-9 items-center justify-center rounded-xl border border-white/85 bg-white/75 text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(15,23,42,0.35)] backdrop-blur-md transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 data-[state=open]:bg-white motion-reduce:active:scale-100 dark:border-white/10 dark:bg-slate-900/75 dark:text-brand-300 [&_svg]:size-[18px]";

/** Popover anchored below the control's right edge (never over it). */
export const MAP_CONTROL_POPOVER_PROPS = {
  side: "bottom",
  align: "end",
  sideOffset: 8,
  collisionPadding: 8,
} as const;

export const MAP_CONTROL_MENU_LABEL_CLASS =
  "mb-1 px-2 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-600";

export const MAP_CONTROL_MENU_ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 transition-colors hover:bg-brandAlt-100 hover:text-brand-900 focus-visible:bg-brandAlt-100 focus-visible:outline-none dark:text-gray-200 dark:hover:bg-white/10";

export function MapTypeSelector({
  selectedMapType,
  onMapTypeChange,
}: MapTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentMapType =
    MAP_TYPES.find((type) => type.id === selectedMapType) || MAP_TYPES[0];
  const CurrentIcon = currentMapType.icon;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Map type: ${currentMapType.name}`}
          className={MAP_CONTROL_BUTTON_CLASS}
        >
          <CurrentIcon aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        {...MAP_CONTROL_POPOVER_PROPS}
        className="w-48 p-1.5"
        style={{ zIndex: ZINDEX.mapControlDropdown }}
      >
        <div className={MAP_CONTROL_MENU_LABEL_CLASS}>Map Type</div>
        <div role="listbox" aria-label="Map type" className="space-y-0.5">
          {MAP_TYPES.map((mapType) => {
            const Icon = mapType.icon;
            const isSelected = selectedMapType === mapType.id;

            return (
              <button
                key={mapType.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onMapTypeChange(mapType);
                  setOpen(false);
                }}
                className={cn(
                  MAP_CONTROL_MENU_ITEM_CLASS,
                  isSelected && "font-medium text-brand-900",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="flex-1 truncate">{mapType.name}</span>
                {isSelected && (
                  <Check
                    aria-hidden
                    className="size-4 shrink-0 text-brand-800"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
