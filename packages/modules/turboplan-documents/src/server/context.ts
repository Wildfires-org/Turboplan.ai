import { getProjectDocumentsByProjectId } from "@wildfires-org/turboplan-db/queries";

/**
 * Load saved project documents and format them as a system prompt context block.
 * Returns undefined if no documents exist for this project.
 */
export async function getProjectDocumentsContext(
  projectId: string,
): Promise<string | undefined> {
  const documents = await getProjectDocumentsByProjectId(projectId);
  if (!documents.length) return undefined;

  const lines = documents.map((d) => {
    const parts = [`- **${d.originalFilename}**`];
    parts.push(`(ID: ${d.id})`);
    if (d.relevance != null) parts.push(`(relevance: ${d.relevance}/100)`);
    if (d.context) parts.push(`— ${d.context}`);
    parts.push(`[URL: ${d.url}]`);
    return parts.join(" ");
  });

  return [
    "## Saved Project Documents",
    "These documents have been saved to the project library.",
    "This list shows titles and metadata only — NOT the documents' content. Use the readProjectDocuments tool with a document's ID to read its full text.",
    "Document titles include the official NEPA document type as a prefix (e.g. EIS, EA, ROD).",
    "Relevance (0-100) indicates how useful the document is for this project.",
    "Context explains why the document matters for project planning.\n",
    ...lines,
  ].join("\n");
}
