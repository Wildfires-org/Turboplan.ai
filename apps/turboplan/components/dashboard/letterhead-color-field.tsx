"use client";

import { Pipette } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

interface LetterheadColorFieldProps {
  // Prefix for the label id and the radio group name, so two fields can be
  // mounted at once.
  idPrefix: string;
  // Brand color as "#rrggbb", or "" for none.
  color: string;
  onColorChange: (color: string) => void;
  // What the color is used for, under the swatches.
  hint: string;
  error?: string;
  disabled?: boolean;
}

// Brand color presets. "Default" clears the color (black text, gray rule).
const COLOR_PRESETS: Array<{ value: string; label: string; swatch: string }> = [
  { value: "", label: "Default", swatch: "bg-[#1f2937]" },
  { value: "#1f5f3a", label: "Forest green", swatch: "bg-[#1f5f3a]" },
  { value: "#14532d", label: "Pine", swatch: "bg-[#14532d]" },
  { value: "#1e3a8a", label: "Navy", swatch: "bg-[#1e3a8a]" },
  { value: "#7c2d12", label: "Rust", swatch: "bg-[#7c2d12]" },
  { value: "#6b21a8", label: "Purple", swatch: "bg-[#6b21a8]" },
];
const DEFAULT_PICKER_COLOR = "#1f2937";

const SWATCH_CLASS =
  "flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 transition-shadow has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 dark:ring-white/20";
const SELECTED_SWATCH_CLASS =
  "ring-2 ring-offset-2 ring-brand-700 ring-offset-background dark:ring-brand-300";

// A letterhead's brand color: preset swatches ("Default" = none) and the
// native picker for any other color, shown with its hex value.
export function LetterheadColorField({
  idPrefix,
  color,
  onColorChange,
  hint,
  error,
  disabled = false,
}: LetterheadColorFieldProps) {
  const isCustomColor =
    !!color && !COLOR_PRESETS.some((preset) => preset.value === color);
  const colorId = `${idPrefix}Color`;
  const errorId = `${idPrefix}ColorError`;

  return (
    <div className="space-y-2">
      <span id={colorId} className="text-sm font-medium">
        Brand color
      </span>
      <div
        role="radiogroup"
        aria-labelledby={colorId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap items-center gap-2.5"
      >
        {COLOR_PRESETS.map((preset) => {
          const isSelected = color === preset.value;
          return (
            <label
              key={preset.label}
              title={preset.label}
              className={cn(
                SWATCH_CLASS,
                preset.swatch,
                isSelected && SELECTED_SWATCH_CLASS,
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}Color`}
                value={preset.value}
                checked={isSelected}
                onChange={() => onColorChange(preset.value)}
                disabled={disabled}
                aria-label={preset.label}
                className="sr-only"
              />
            </label>
          );
        })}
        {/* Any other color: the native picker. Shows the current custom
            color (or the default) as its swatch. */}
        <label
          title="Custom color"
          className={cn(
            SWATCH_CLASS,
            "relative overflow-hidden",
            isCustomColor && SELECTED_SWATCH_CLASS,
          )}
        >
          <input
            type="color"
            value={color || DEFAULT_PICKER_COLOR}
            onChange={(event) => onColorChange(event.target.value)}
            disabled={disabled}
            aria-label="Custom color"
            className="size-12 shrink-0 cursor-pointer border-0 bg-transparent p-0"
          />
          {!isCustomColor && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white text-gray-550 dark:bg-zinc-800">
              <Pipette aria-hidden className="size-4" />
            </span>
          )}
        </label>
        {color && (
          <span className="font-mono text-xs uppercase text-gray-550">
            {color}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-error-700">
          {error}
        </p>
      )}
      <p className="text-xs text-gray-550">{hint}</p>
    </div>
  );
}
