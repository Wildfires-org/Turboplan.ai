"use client";

import { useId } from "react";

import { Info } from "lucide-react";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";

import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import {
  PANEL_CLASS,
  PANEL_TITLE_CLASS,
  STICKY_TOOLBAR_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";
import { OrganizationDocumentList } from "./organization-document-list";
import { OrganizationDocumentsDropzone } from "./organization-documents-dropzone";
import { OrganizationPromptForm } from "./organization-prompt-form";

interface OrganizationContextSectionProps {
  userId: string;
  organizationId: string;
  orgSlug: string;
}

const PANEL_LEAD_CLASS = "text-[13px] leading-5 text-gray-550";

/**
 * The Organization Context page body: the standing AI prompt and the
 * reference documents. Owners and editors (organization UPDATE) edit both;
 * everyone else with access reads them.
 */
export const OrganizationContextSection = ({
  userId,
  organizationId,
  orgSlug,
}: OrganizationContextSectionProps) => {
  const promptHeadingId = useId();
  const documentsHeadingId = useId();

  const { hasPermission: canEdit, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.UPDATE,
  });

  return (
    <div className="space-y-2">
      <div className={STICKY_TOOLBAR_CLASS}>
        <OrgTabNav orgSlug={orgSlug} />
      </div>

      <div className="space-y-4 pb-8">
        <p
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-blue-700/10 bg-blue-50/70 px-4 py-3 text-[13px] leading-5 text-blue-900 dark:border-blue-300/15 dark:bg-blue-950/30 dark:text-blue-100"
        >
          <Info
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-blue-700 dark:text-blue-300"
          />
          Shared with the AI in chats and research for everyone with access to
          this organization&apos;s projects.
        </p>

        <section
          aria-labelledby={promptHeadingId}
          className={cn(PANEL_CLASS, "space-y-4")}
        >
          <div>
            <h2 id={promptHeadingId} className={PANEL_TITLE_CLASS}>
              Organization prompt
            </h2>
            <p className={PANEL_LEAD_CLASS}>
              Standing instructions for the AI: who you are, the standards you
              follow, and how you like work written.
            </p>
          </div>
          <OrganizationPromptForm
            organizationId={organizationId}
            canEdit={canEdit}
            isCheckingPermission={isChecking}
          />
        </section>

        <section
          aria-labelledby={documentsHeadingId}
          className={cn(PANEL_CLASS, "space-y-4")}
        >
          <div>
            <h2 id={documentsHeadingId} className={PANEL_TITLE_CLASS}>
              Reference documents
            </h2>
            <p className={PANEL_LEAD_CLASS}>
              Policies, standards, templates and past work. The AI gets a short
              summary of each and can open the full text when it needs it.
            </p>
          </div>
          {canEdit && (
            <OrganizationDocumentsDropzone organizationId={organizationId} />
          )}
          <OrganizationDocumentList
            organizationId={organizationId}
            canEdit={canEdit}
          />
        </section>
      </div>
    </div>
  );
};
