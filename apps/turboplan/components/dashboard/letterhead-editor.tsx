"use client";

import { useState } from "react";

import { Pipette } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { cn, Label, Textarea } from "@wildfires-org/turboplan-utils";
import {
  type LetterheadLayout,
  parseLetterheadLines,
} from "@wildfires-org/turboplan-workspace/types";

import { LetterheadBand } from "@/components/letterhead-band";
import type { LetterheadImportValues } from "@/lib/letterhead-import";
import { DocumentLogoUpload } from "./document-logo-upload";
import { LetterheadImport } from "./letterhead-import";

interface LetterheadEditorProps {
  // Prefix for input ids and the radio group name, so two editors can be
  // mounted at once (the org branding tab and the library dialog).
  idPrefix: string;
  // Spread onto the textareas (register("documentLetterheadLines"), …).
  linesField: UseFormRegisterReturn;
  contactField: UseFormRegisterReturn;
  // Current form values, for the layout picker and the live preview.
  layout: LetterheadLayout;
  lines: string;
  contact: string;
  logoUrl: string;
  // Brand color as "#rrggbb", or "" for none.
  color: string;
  onLayoutChange: (layout: LetterheadLayout) => void;
  onLogoChange: (url: string | null) => void;
  onColorChange: (color: string) => void;
  // "Import from document": applies the fields read from an uploaded letter.
  onImport: (values: LetterheadImportValues) => void;
  // Whose letterhead is edited, for the import's permission check.
  organizationId: string;
  officeId?: string;
  // Seeds the logo upload preview.
  initialLogoUrl?: string | null;
  linesError?: string;
  contactError?: string;
  disabled?: boolean;
}

const LAYOUT_OPTIONS: Array<{ value: LetterheadLayout; label: string }> = [
  { value: "columns", label: "Agency columns" },
  { value: "split", label: "Logo left" },
  { value: "centered", label: "Centered" },
  { value: "banner", label: "Banner image" },
];

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

// Structured letterhead inputs: layout picker, logo, name/contact lines and a
// live preview. Used for the office/org default letterhead and for the org's
// library letterheads.
export function LetterheadEditor({
  idPrefix,
  linesField,
  contactField,
  layout,
  lines,
  contact,
  logoUrl,
  color,
  onLayoutChange,
  onLogoChange,
  onColorChange,
  onImport,
  organizationId,
  officeId,
  initialLogoUrl,
  linesError,
  contactError,
  disabled = false,
}: LetterheadEditorProps) {
  const isBanner = layout === "banner";
  const nameLines = parseLetterheadLines(lines);
  const contactLines = parseLetterheadLines(contact);
  const hasPreview = isBanner
    ? !!logoUrl
    : nameLines.length > 0 || contactLines.length > 0;
  const hasMarginLogo = layout === "columns" && !!logoUrl;
  const isCustomColor =
    !!color && !COLOR_PRESETS.some((preset) => preset.value === color);
  const linesId = `${idPrefix}Lines`;
  const contactId = `${idPrefix}Contact`;
  const colorId = `${idPrefix}Color`;
  // Bumped by an import that sets a logo, to reseed the upload preview.
  const [importCount, setImportCount] = useState(0);

  const handleImport = (values: LetterheadImportValues) => {
    onImport(values);
    if (values.logoUrl) {
      setImportCount((count) => count + 1);
    }
  };

  return (
    <>
      <LetterheadImport
        organizationId={organizationId}
        officeId={officeId}
        onImport={handleImport}
        disabled={disabled}
      />

      <div className="space-y-2">
        <span className="text-sm font-medium">Layout</span>
        <div
          role="radiogroup"
          aria-label="Letterhead layout"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {LAYOUT_OPTIONS.map((option) => {
            const isSelected = layout === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-background/70 p-2 text-xs ring-1 ring-inset ring-border transition-colors hover:bg-background has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 dark:bg-white/5",
                  isSelected &&
                    "bg-background text-brand-800 ring-2 ring-brand-700 dark:text-brand-300",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}Layout`}
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onLayoutChange(option.value)}
                  disabled={disabled}
                  className="sr-only"
                />
                <LayoutSchematic layout={option.value} />
                <span className="text-center font-medium">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <DocumentLogoUpload
        key={importCount}
        label={isBanner ? "Letterhead image" : "Document logo"}
        value={importCount > 0 ? logoUrl || null : (initialLogoUrl ?? null)}
        onChange={onLogoChange}
        helperText={
          isBanner
            ? "Upload your full letterhead as one wide image (PNG or JPEG, at least 2000px wide)."
            : undefined
        }
        isWide={isBanner}
        disabled={disabled}
      />

      {/* A banner is the whole letterhead, so the text lines don't apply;
          react-hook-form keeps their values while they're unmounted. */}
      {!isBanner && (
        <>
          <div className="space-y-2">
            <Label htmlFor={linesId} className="text-sm font-medium">
              Organization lines
            </Label>
            <Textarea
              id={linesId}
              rows={3}
              placeholder={
                "United States Department of Agriculture\nForest Service\nDescanso Ranger District"
              }
              {...linesField}
            />
            {linesError && (
              <p className="text-xs text-error-700">{linesError}</p>
            )}
            <p className="text-xs text-gray-550">
              One per line, shown in bold.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={contactId} className="text-sm font-medium">
              Address &amp; contact
            </Label>
            <Textarea
              id={contactId}
              rows={3}
              placeholder={
                "3348 Alpine Boulevard\nAlpine, CA 91901\n(619) 445-6235"
              }
              {...contactField}
            />
            {contactError && (
              <p className="text-xs text-error-700">{contactError}</p>
            )}
            <p className="text-xs text-gray-550">One per line.</p>
          </div>
        </>
      )}

      <div className="space-y-2">
        <span id={colorId} className="text-sm font-medium">
          Brand color
        </span>
        <div
          role="radiogroup"
          aria-labelledby={colorId}
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
        <p className="text-xs text-gray-550">
          Used for the rule under the letterhead
          {isBanner ? "" : " and the bold name lines"}.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Preview</span>
        {/* A sheet of paper; the agency layout hangs its logo in the extra
            left padding (the page margin). */}
        <div
          className={cn(
            "overflow-hidden rounded-xl bg-white p-4 text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100",
            hasMarginLogo && "md:pl-16",
          )}
        >
          {hasPreview ? (
            <LetterheadBand
              letterhead={{
                layout,
                nameLines,
                contactLines,
                color: color || null,
              }}
              logoSrc={logoUrl || null}
              className="mb-0"
            />
          ) : (
            <p className="py-3 text-center text-xs text-gray-550">
              {isBanner
                ? "Upload a letterhead image to preview it."
                : "Add organization lines to preview the letterhead."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// Tiny wireframe of each layout: a logo block, bold name bars and thin contact
// bars, with the rule beneath.
const LayoutSchematic = ({ layout }: { layout: LetterheadLayout }) => (
  <svg
    viewBox="0 0 64 36"
    aria-hidden
    className="h-9 w-16 text-current opacity-80"
    fill="currentColor"
  >
    {layout === "columns" && (
      <>
        <rect x="0" y="4" width="7" height="10" rx="1" opacity="0.45" />
        <rect x="10" y="5" width="12" height="3" rx="1" />
        <rect x="10" y="10" width="8" height="3" rx="1" />
        <rect x="25" y="5" width="9" height="3" rx="1" />
        <rect x="37" y="5" width="9" height="3" rx="1" />
        <rect x="50" y="5" width="14" height="2" rx="1" opacity="0.45" />
        <rect x="54" y="9" width="10" height="2" rx="1" opacity="0.45" />
        <rect x="52" y="13" width="12" height="2" rx="1" opacity="0.45" />
      </>
    )}
    {layout === "split" && (
      <>
        <rect x="0" y="3" width="11" height="14" rx="1.5" opacity="0.45" />
        <rect x="14" y="5" width="20" height="3" rx="1" />
        <rect x="14" y="10" width="14" height="3" rx="1" />
        <rect x="48" y="5" width="16" height="2" rx="1" opacity="0.45" />
        <rect x="52" y="9" width="12" height="2" rx="1" opacity="0.45" />
        <rect x="50" y="13" width="14" height="2" rx="1" opacity="0.45" />
      </>
    )}
    {layout === "banner" && (
      <rect x="0" y="3" width="64" height="15" rx="1.5" opacity="0.45" />
    )}
    {layout === "centered" && (
      <>
        <rect x="27" y="1" width="10" height="9" rx="1.5" opacity="0.45" />
        <rect x="16" y="13" width="32" height="3" rx="1" />
        <rect x="22" y="18" width="20" height="3" rx="1" />
        <rect x="12" y="24" width="40" height="2" rx="1" opacity="0.45" />
      </>
    )}
    <rect
      x="0"
      y={layout === "centered" ? 30 : 21}
      width="64"
      height="1"
      opacity="0.7"
    />
  </svg>
);
