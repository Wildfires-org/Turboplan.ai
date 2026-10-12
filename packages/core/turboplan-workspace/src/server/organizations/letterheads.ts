import type { DocumentLetterheadRow } from "@wildfires-org/turboplan-db";

import type { LibraryLetterhead } from "../../letterhead";

export const toLibraryLetterhead = (
  row: DocumentLetterheadRow,
): LibraryLetterhead => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  description: row.description,
  layout: row.layout,
  lines: row.lines,
  contact: row.contact,
  logoUrl: row.logoUrl,
  color: row.color,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
