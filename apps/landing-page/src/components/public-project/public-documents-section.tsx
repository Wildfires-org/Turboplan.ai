import {
  DocumentsReadOnlyList,
  type ReadOnlyDocument,
} from "@wildfires-org/turboplan-documents/client";

interface PublicDocumentsSectionProps {
  documents: ReadOnlyDocument[];
  entity: "project" | "template";
}

export function PublicDocumentsSection({
  documents,
  entity,
}: PublicDocumentsSectionProps) {
  return (
    <DocumentsReadOnlyList
      documents={documents}
      variant="compact"
      emptyMessage={`This ${entity} doesn't have any documents yet.`}
    />
  );
}
