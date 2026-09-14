import {
  DocumentsReadOnlyList,
  type ReadOnlyDocument,
} from "@wildfires-org/turboplan-documents/client";

interface PublicDocumentsSectionProps {
  documents: ReadOnlyDocument[];
}

export function PublicDocumentsSection({
  documents,
}: PublicDocumentsSectionProps) {
  return <DocumentsReadOnlyList documents={documents} variant="compact" />;
}
