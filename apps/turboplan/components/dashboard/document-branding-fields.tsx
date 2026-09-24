"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { Input, Label } from "@wildfires-org/turboplan-utils";

import { DocumentLogoUpload } from "./document-logo-upload";

interface DocumentBrandingFieldsProps {
  // Spread onto the footer text/note inputs (register("documentFooterText"), …).
  textField: UseFormRegisterReturn;
  noteField: UseFormRegisterReturn;
  // Persist the uploaded logo URLs back into the form (setValue(...)).
  onDocumentLogoChange: (url: string | null) => void;
  onFooterLogoChange: (url: string | null) => void;
  // Initial logo URLs seed the upload previews.
  initialDocumentLogoUrl?: string | null;
  initialFooterLogoUrl?: string | null;
  textError?: string;
  noteError?: string;
  disabled?: boolean;
}

// Shared document-branding inputs (letterhead logo + footer tagline/note/logo)
// used by both the edit-office and edit-organization dialogs.
export function DocumentBrandingFields({
  textField,
  noteField,
  onDocumentLogoChange,
  onFooterLogoChange,
  initialDocumentLogoUrl,
  initialFooterLogoUrl,
  textError,
  noteError,
  disabled = false,
}: DocumentBrandingFieldsProps) {
  return (
    <>
      {/* Document Letterhead Logo Section */}
      <DocumentLogoUpload
        label="Document logo"
        value={initialDocumentLogoUrl ?? null}
        onChange={onDocumentLogoChange}
        disabled={disabled}
      />

      {/* Document Footer Section */}
      {/* Nested group: a tinted inset panel instead of a bordered box */}
      <fieldset className="min-w-0 space-y-4 rounded-2xl bg-brandAlt-100/80 p-4 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10">
        <legend className="float-left mb-1 w-full text-sm font-medium text-foreground">
          Document footer
        </legend>

        <div className="space-y-2">
          <Label htmlFor="documentFooterText" className="text-sm font-medium">
            Footer tagline
          </Label>
          <Input
            id="documentFooterText"
            placeholder="Caring for the Land and Serving People"
            {...textField}
          />
          {textError && <p className="text-xs text-error-700">{textError}</p>}
          <p className="text-xs text-gray-550">
            Centered at the bottom of every page.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentFooterNote" className="text-sm font-medium">
            Footer note
          </Label>
          <Input
            id="documentFooterNote"
            placeholder="Printed on Recycled Paper"
            {...noteField}
          />
          {noteError && <p className="text-xs text-error-700">{noteError}</p>}
          <p className="text-xs text-gray-550">Right-aligned in the footer.</p>
        </div>

        <DocumentLogoUpload
          label="Footer logo"
          value={initialFooterLogoUrl ?? null}
          onChange={onFooterLogoChange}
          helperText="Small image shown at the left of the footer. PNG or JPEG."
          disabled={disabled}
        />
      </fieldset>
    </>
  );
}
