"use client";

import { useId } from "react";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import {
  PANEL_CLASS,
  PANEL_TITLE_CLASS,
  STICKY_TOOLBAR_CLASS,
} from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { OrganizationDocumentList } from "./organization-document-list";
import { OrganizationDocumentsDropzone } from "./organization-documents-dropzone";
import { OrganizationMemoryList } from "./organization-memory-list";
import { OrganizationPromptForm } from "./organization-prompt-form";

interface OrganizationContextSectionProps {
  userId: string;
  organizationId: string;
  organizationName: string;
  orgSlug: string;
  /**
   * "page": the Organization Context page (organization tabs on top).
   * "embedded": the Organization tab of a project's Context (page or chat
   * panel), headed by the organization's name and a link to its page.
   */
  variant?: "page" | "embedded";
  /** In a narrow container (the chat Context panel): stack rows */
  isNarrow?: boolean;
}

const PANEL_LEAD_CLASS = "text-[13px] leading-5 text-gray-550";

/**
 * The organization's context: the standing AI prompt, the notes the assistant
 * saved from chats and the reference documents. Owners and editors
 * (organization UPDATE) edit them; everyone else with access reads them.
 */
export const OrganizationContextSection = ({
  userId,
  organizationId,
  organizationName,
  orgSlug,
  variant = "page",
  isNarrow = false,
}: OrganizationContextSectionProps) => {
  const promptHeadingId = useId();
  const memoryHeadingId = useId();
  const documentsHeadingId = useId();
  const isEmbedded = variant === "embedded";
  // Embedded, the sections sit under the organization's name (an h3).
  const SectionHeading = isEmbedded ? "h4" : "h2";

  const { hasPermission: canEdit, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.UPDATE,
  });

  return (
    <div className={cn(!isEmbedded && "space-y-2")}>
      {isEmbedded ? null : (
        <div className={STICKY_TOOLBAR_CLASS}>
          <OrgTabNav orgSlug={orgSlug} />
        </div>
      )}

      <div className={cn("space-y-4", !isEmbedded && "pb-8")}>
        {isEmbedded && (
          <div
            className={cn(
              "flex flex-col gap-3",
              !isNarrow && "sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            <h3
              className={cn(
                PANEL_TITLE_CLASS,
                "min-w-0 text-[18px] leading-7 [overflow-wrap:anywhere]",
              )}
            >
              {organizationName}
            </h3>
            <Button
              asChild
              variant="glass"
              size="sm"
              className={cn("shrink-0 self-start", !isNarrow && "sm:self-auto")}
            >
              <Link href={AppUrls.organizationContext(orgSlug)}>
                Open organization context
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}

        <p
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-blue-700/10 bg-blue-50/70 px-4 py-3 text-[13px] leading-5 text-blue-900 dark:border-blue-300/15 dark:bg-blue-950/30 dark:text-blue-100"
        >
          <Info
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-blue-700 dark:text-blue-300"
          />
          {isEmbedded
            ? `Shared with the AI in every project in ${organizationName}, not only this one.`
            : "Shared with the AI in chats and research for everyone with access to this organization's projects."}
        </p>

        <section
          aria-labelledby={promptHeadingId}
          className={cn(PANEL_CLASS, "space-y-4")}
        >
          <div>
            <SectionHeading id={promptHeadingId} className={PANEL_TITLE_CLASS}>
              Organization prompt
            </SectionHeading>
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
          aria-labelledby={memoryHeadingId}
          className={cn(PANEL_CLASS, "space-y-4")}
        >
          <div>
            <SectionHeading id={memoryHeadingId} className={PANEL_TITLE_CLASS}>
              Memory
            </SectionHeading>
            <p className={PANEL_LEAD_CLASS}>
              Notes the assistant saved from chats. Shared with the AI in every
              project chat and research run in this organization.
            </p>
          </div>
          <OrganizationMemoryList
            organizationId={organizationId}
            organizationName={organizationName}
            canEdit={canEdit}
          />
        </section>

        <section
          aria-labelledby={documentsHeadingId}
          className={cn(PANEL_CLASS, "space-y-4")}
        >
          <div>
            <SectionHeading
              id={documentsHeadingId}
              className={PANEL_TITLE_CLASS}
            >
              Reference documents
            </SectionHeading>
            <p className={PANEL_LEAD_CLASS}>
              Policies, standards, templates and past work. The AI gets a short
              summary of each and can open the full text when it needs it.
            </p>
          </div>
          {canEdit && (
            <OrganizationDocumentsDropzone
              organizationId={organizationId}
              isNarrow={isNarrow}
            />
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
