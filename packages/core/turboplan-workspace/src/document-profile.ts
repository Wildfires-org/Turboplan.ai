// Document profile: facts about an office/organization that generated
// documents keep needing (signatory, comment contact, office hours, ...). The
// AI document generator receives them as confirmed facts so it does not write
// [INSERT: ...] placeholders for them. Client-safe: no server imports.

import { z } from "zod";

import type { DocumentProfile } from "@wildfires-org/turboplan-db/types";

export type { DocumentProfile };

export const DOCUMENT_PROFILE_FIELDS: {
  key: keyof DocumentProfile;
  label: string;
}[] = [
  { key: "signatoryName", label: "Signatory name" },
  { key: "signatoryTitle", label: "Signatory title" },
  { key: "contactName", label: "Comment/contact person" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "officeHours", label: "Office hours" },
  { key: "fileCode", label: "Default file code" },
  { key: "facts", label: "Other facts" },
];

export const DOCUMENT_PROFILE_FACTS_MAX_CHARS = 2_000;

const profileString = z
  .string()
  .trim()
  .max(200, "Must be at most 200 characters")
  .optional();

export const documentProfileSchema = z.object({
  signatoryName: profileString,
  signatoryTitle: profileString,
  contactName: profileString,
  contactEmail: z
    .string()
    .trim()
    .max(200, "Must be at most 200 characters")
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Please enter a valid email",
    })
    .optional(),
  contactPhone: profileString,
  officeHours: profileString,
  fileCode: profileString,
  facts: z
    .string()
    .trim()
    .max(
      DOCUMENT_PROFILE_FACTS_MAX_CHARS,
      `Must be at most ${DOCUMENT_PROFILE_FACTS_MAX_CHARS} characters`,
    )
    .optional(),
});

export type DocumentProfileFormData = z.infer<typeof documentProfileSchema>;

const splitFactLines = (facts: string | null | undefined): string[] =>
  (facts ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/**
 * Trims every field, drops empty ones and de-duplicates fact lines. Returns
 * null when nothing is left so an all-empty profile is stored as NULL.
 */
export const normalizeDocumentProfile = (
  profile: DocumentProfile | null | undefined,
): DocumentProfile | null => {
  if (!profile) {
    return null;
  }
  const result: DocumentProfile = {};
  for (const { key } of DOCUMENT_PROFILE_FIELDS) {
    const value =
      key === "facts"
        ? [...new Set(splitFactLines(profile.facts))].join("\n")
        : (profile[key] ?? "").trim();
    if (value !== "") {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
};

/**
 * Per field the office value wins when non-empty (trimmed). Facts are merged:
 * office lines first, then organization lines, de-duplicated.
 */
export const mergeDocumentProfiles = (
  office: DocumentProfile | null | undefined,
  org: DocumentProfile | null | undefined,
): DocumentProfile => {
  const result: DocumentProfile = {};
  for (const { key } of DOCUMENT_PROFILE_FIELDS) {
    if (key === "facts") {
      continue;
    }
    const value = office?.[key]?.trim() || org?.[key]?.trim() || "";
    if (value !== "") {
      result[key] = value;
    }
  }
  const facts = [
    ...new Set([
      ...splitFactLines(office?.facts),
      ...splitFactLines(org?.facts),
    ]),
  ];
  if (facts.length > 0) {
    result.facts = facts.join("\n");
  }
  return result;
};

/** Human-readable fact lines for the AI prompt / UI; empty fields skipped. */
export const documentProfileToFacts = (profile: DocumentProfile): string[] => {
  const value = (key: keyof DocumentProfile) => profile[key]?.trim() ?? "";
  const facts: string[] = [];

  const signatory = [value("signatoryName"), value("signatoryTitle")]
    .filter((part) => part !== "")
    .join(", ");
  if (signatory) {
    facts.push(`Signatory: ${signatory}`);
  }
  if (value("contactName")) {
    facts.push(`Comment/contact person: ${value("contactName")}`);
  }
  if (value("contactEmail")) {
    facts.push(`Contact email: ${value("contactEmail")}`);
  }
  if (value("contactPhone")) {
    facts.push(`Contact phone: ${value("contactPhone")}`);
  }
  if (value("officeHours")) {
    facts.push(`Office hours: ${value("officeHours")}`);
  }
  if (value("fileCode")) {
    facts.push(`Default file code: ${value("fileCode")}`);
  }
  return [...facts, ...new Set(splitFactLines(profile.facts))];
};

/**
 * Appends `${label}: ${value}` to the profile's facts unless an identical line
 * already exists. Returns the updated profile and whether it changed.
 */
export const appendDocumentProfileFact = (
  profile: DocumentProfile | null | undefined,
  label: string,
  value: string,
): { profile: DocumentProfile; changed: boolean } => {
  const line = `${label.trim()}: ${value.trim()}`;
  const lines = splitFactLines(profile?.facts);
  if (lines.includes(line)) {
    return { profile: profile ?? {}, changed: false };
  }
  return {
    profile: { ...profile, facts: [...lines, line].join("\n") },
    changed: true,
  };
};
