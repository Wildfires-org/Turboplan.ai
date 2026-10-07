import {
  DocumentsReadOnlyList,
  type ReadOnlyDocument,
} from "@wildfires-org/turboplan-documents/client";

import { PublicEmptyState } from "./public-empty-state";

interface PublicDocumentsSectionProps {
  documents: ReadOnlyDocument[];
  entity: "project" | "template";
}

export function PublicDocumentsSection({
  documents,
  entity,
}: PublicDocumentsSectionProps) {
  if (documents.length === 0) {
    return (
      <PublicEmptyState
        title="No documents yet"
        message={`This ${entity} doesn't have any documents yet.`}
      />
    );
  }

  return <DocumentsReadOnlyList documents={documents} variant="compact" />;
}
