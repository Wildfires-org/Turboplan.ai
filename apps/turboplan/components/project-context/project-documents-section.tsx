"use client";

import {
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";

import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectDocumentsSectionProps {
  projectId: string;
  userId: string;
  /** In a narrow container (the chat Context panel): one card per row */
  isNarrow?: boolean;
}

/**
 * The documents uploaded to a project (not the researched ones), with rename
 * and delete. Renders nothing while there are none.
 */
export const ProjectDocumentsSection = ({
  projectId,
  userId,
  isNarrow = false,
}: ProjectDocumentsSectionProps) => {
  const { documents } = useProjectDocuments({ projectId, source: "upload" });

  if (documents.length === 0) {
    return null;
  }

  return (
    <section className={cn(PANEL_CLASS, "space-y-4")}>
      <div>
        <h3 className={PANEL_TITLE_CLASS}>Documents</h3>
        <p className="text-[13px] leading-5 text-gray-550">
          Uploaded plans, permits and reports. Their text is read by the
          assistant once extracted.
        </p>
      </div>
      {/* The only poller of this list on the page (showExtractionStatus
          polls while text is pending); the dropzone rows read the same SWR
          cache and update with it. */}
      <DocumentsSectionUI
        projectId={projectId}
        userId={userId}
        source="upload"
        showExtractionStatus
        singleColumn={isNarrow}
      />
    </section>
  );
};
