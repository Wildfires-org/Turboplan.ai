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
      <div className="space-y-4 rounded-md border p-3">
        <span className="text-sm font-medium">Document footer</span>

        <div className="space-y-2">
          <Label htmlFor="documentFooterText" className="text-sm font-medium">
            Footer tagline
          </Label>
          <Input
            id="documentFooterText"
            placeholder="Caring for the Land and Serving People"
            {...textField}
          />
          {textError && <p className="text-xs text-red-500">{textError}</p>}
          <p className="text-xs text-muted-foreground">
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
          {noteError && <p className="text-xs text-red-500">{noteError}</p>}
          <p className="text-xs text-muted-foreground">
            Right-aligned in the footer.
          </p>
        </div>

        <DocumentLogoUpload
          label="Footer logo"
          value={initialFooterLogoUrl ?? null}
          onChange={onFooterLogoChange}
          helperText="Small image shown at the left of the footer. PNG or JPEG."
          disabled={disabled}
        />
      </div>
    </>
  );
}
