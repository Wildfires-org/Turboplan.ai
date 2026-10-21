"use client";

import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";

import { Input, Label, Textarea } from "@wildfires-org/turboplan-utils";
import {
  type DocumentProfile,
  isLetterheadConfigured,
  type LetterheadLayout,
  parseLetterheadLines,
} from "@wildfires-org/turboplan-workspace/types";

import type { LetterheadImportValues } from "@/lib/letterhead-import";
import { DefaultLetterheadGridSettings } from "./default-letterhead-grid-settings";
import { DocumentLogoUpload } from "./document-logo-upload";
import { LetterheadEditor } from "./letterhead-editor";

interface DocumentBrandingFieldsProps {
  // Spread onto the footer text/note inputs (register("documentFooterText"), …).
  textField: UseFormRegisterReturn;
  noteField: UseFormRegisterReturn;
  // Spread onto the letterhead textareas (register("documentLetterheadLines"), …).
  letterheadLinesField: UseFormRegisterReturn;
  letterheadContactField: UseFormRegisterReturn;
  // register(`documentProfile.${key}`) for each "Document details" input.
  registerProfileField: (key: DocumentProfileKey) => UseFormRegisterReturn;
  profileErrors?: Partial<Record<DocumentProfileKey, string>>;
  // Current form values, for the layout picker and the live preview.
  letterheadLayout: LetterheadLayout;
  letterheadLines: string;
  letterheadContact: string;
  documentLogoUrl: string;
  letterheadColor: string;
  onLetterheadLayoutChange: (layout: LetterheadLayout) => void;
  onLetterheadColorChange: (color: string) => void;
  // Applies a letterhead read by "Import from document".
  onLetterheadImport: (values: LetterheadImportValues) => void;
  // Whose letterhead this is (the import checks edit permission on it).
  organizationId: string;
  officeId?: string;
  // Persist the uploaded logo URLs back into the form (setValue(...)).
  onDocumentLogoChange: (url: string | null) => void;
  onFooterLogoChange: (url: string | null) => void;
  // Seeds the footer logo upload's preview.
  initialFooterLogoUrl?: string | null;
  textError?: string;
  noteError?: string;
  letterheadLinesError?: string;
  letterheadContactError?: string;
  disabled?: boolean;
}

type DocumentProfileKey = keyof DocumentProfile;

type ProfileInput = {
  key: Exclude<DocumentProfileKey, "facts">;
  label: string;
  placeholder: string;
  type?: "email" | "tel";
};

const PROFILE_INPUTS: ProfileInput[] = [
  { key: "signatoryName", label: "Signatory name", placeholder: "Jane Doe" },
  {
    key: "signatoryTitle",
    label: "Signatory title",
    placeholder: "District Ranger",
  },
  { key: "contactName", label: "Contact person", placeholder: "John Smith" },
  {
    key: "contactEmail",
    label: "Contact email",
    placeholder: "comments@agency.gov",
    type: "email",
  },
  {
    key: "contactPhone",
    label: "Contact phone",
    placeholder: "(555) 555-0100",
    type: "tel",
  },
  {
    key: "officeHours",
    label: "Office hours",
    placeholder: "Mon–Fri, 8:00 a.m.–4:30 p.m.",
  },
  { key: "fileCode", label: "Default file code", placeholder: "1950" },
];

const PROFILE_KEYS: DocumentProfileKey[] = [
  ...PROFILE_INPUTS.map((input) => input.key),
  "facts",
];

// Form default values: every field present (controlled inputs, no undefined).
export const toDocumentProfileFormValues = (
  profile: DocumentProfile | null | undefined,
): Record<DocumentProfileKey, string> =>
  Object.fromEntries(
    PROFILE_KEYS.map((key) => [key, profile?.[key] ?? ""]),
  ) as Record<DocumentProfileKey, string>;

export const toDocumentProfileErrors = (
  errors: FieldErrors<DocumentProfile> | undefined,
): Partial<Record<DocumentProfileKey, string>> =>
  Object.fromEntries(
    PROFILE_KEYS.flatMap((key) => {
      const message = errors?.[key]?.message;
      return message ? [[key, message]] : [];
    }),
  );

// Nested group: a tinted inset panel instead of a bordered box.
const GROUP_CLASS =
  "min-w-0 space-y-4 rounded-2xl bg-brandAlt-100/80 p-4 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10";
const LEGEND_CLASS =
  "float-left mb-1 w-full text-sm font-medium text-foreground";

// Shared document-branding inputs (structured letterhead + logo, footer
// tagline/note/logo) used by both the edit-office and edit-organization dialogs.
export function DocumentBrandingFields({
  textField,
  noteField,
  letterheadLinesField,
  letterheadContactField,
  registerProfileField,
  profileErrors,
  letterheadLayout,
  letterheadLines,
  letterheadContact,
  documentLogoUrl,
  letterheadColor,
  onLetterheadLayoutChange,
  onLetterheadColorChange,
  onLetterheadImport,
  organizationId,
  officeId,
  onDocumentLogoChange,
  onFooterLogoChange,
  initialFooterLogoUrl,
  textError,
  noteError,
  letterheadLinesError,
  letterheadContactError,
  disabled = false,
}: DocumentBrandingFieldsProps) {
  const isBanner = letterheadLayout === "banner";

  return (
    <>
      {/* Document Letterhead Section */}
      <fieldset className={GROUP_CLASS}>
        <legend className={LEGEND_CLASS}>Letterhead</legend>
        <p className="text-xs text-gray-550">
          When set, new documents use this letterhead instead of one written by
          the AI.
        </p>

        {/* A default saved from a document's letterhead replaces the layout
            settings while it is set; react-hook-form keeps their values
            while they are hidden. The document logo stays the margin logo
            of a grid without logo cells, so the grid view uploads it too —
            unless it is a banner's image. */}
        <DefaultLetterheadGridSettings
          owner={
            officeId
              ? { kind: "office", id: officeId }
              : { kind: "organization", id: organizationId }
          }
          marginLogoSrc={isBanner ? null : documentLogoUrl || null}
          onMarginLogoChange={isBanner ? undefined : onDocumentLogoChange}
          hasLayoutLetterhead={isLetterheadConfigured(
            letterheadLayout,
            parseLetterheadLines(letterheadLines),
            documentLogoUrl,
          )}
          disabled={disabled}
        >
          <LetterheadEditor
            idPrefix="documentLetterhead"
            linesField={letterheadLinesField}
            contactField={letterheadContactField}
            layout={letterheadLayout}
            lines={letterheadLines}
            contact={letterheadContact}
            logoUrl={documentLogoUrl}
            color={letterheadColor}
            onLayoutChange={onLetterheadLayoutChange}
            onColorChange={onLetterheadColorChange}
            onImport={onLetterheadImport}
            organizationId={organizationId}
            officeId={officeId}
            onLogoChange={onDocumentLogoChange}
            linesError={letterheadLinesError}
            contactError={letterheadContactError}
            disabled={disabled}
          />
        </DefaultLetterheadGridSettings>
      </fieldset>

      {/* Document Details Section */}
      <fieldset className={GROUP_CLASS}>
        <legend className={LEGEND_CLASS}>Document details</legend>
        <p className="text-xs text-gray-550">
          Used to fill documents automatically instead of leaving [INSERT]
          placeholders. Office values override the organization&apos;s.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROFILE_INPUTS.map(({ key, label, placeholder, type }) => (
            <div key={key} className="min-w-0 space-y-2">
              <Label
                htmlFor={`documentProfile-${key}`}
                className="text-sm font-medium"
              >
                {label}
              </Label>
              <Input
                id={`documentProfile-${key}`}
                type={type}
                placeholder={placeholder}
                {...registerProfileField(key)}
              />
              {profileErrors?.[key] && (
                <p className="text-xs text-error-700">{profileErrors[key]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="documentProfile-facts"
            className="text-sm font-medium"
          >
            Other facts
          </Label>
          <Textarea
            id="documentProfile-facts"
            rows={4}
            placeholder="Comments email: comments-pacificsouthwest-cleveland-descanso@usda.gov"
            {...registerProfileField("facts")}
          />
          {profileErrors?.facts && (
            <p className="text-xs text-error-700">{profileErrors.facts}</p>
          )}
          <p className="text-xs text-gray-550">One fact per line.</p>
        </div>
      </fieldset>

      {/* Document Footer Section */}
      <fieldset className={GROUP_CLASS}>
        <legend className={LEGEND_CLASS}>Document footer</legend>

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
