"use client";

import { useId } from "react";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@wildfires-org/turboplan-utils";

import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { OrganizationDocumentList } from "./organization-document-list";
import { OrganizationMemoryList } from "./organization-memory-list";

interface OrganizationContextPanelProps {
  organizationId: string;
  organizationName: string;
  orgSlug: string;
  /** Owner or editor of the organization: delete notes, manage documents */
  canEdit: boolean;
}

const SUBHEADING_CLASS = "text-[13px] font-medium leading-5 text-foreground";

/**
 * The organization's context as seen from one of its projects: the notes the
 * assistant saved and the reference documents, with a link to the full
 * Organization Context page (where the prompt is edited).
 */
export const OrganizationContextPanel = ({
  organizationId,
  organizationName,
  orgSlug,
  canEdit,
}: OrganizationContextPanelProps) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(PANEL_CLASS, "space-y-4")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id={headingId}
            className={cn(PANEL_TITLE_CLASS, "[overflow-wrap:anywhere]")}
          >
            {organizationName} context
          </h3>
          <p className="text-[13px] leading-5 text-gray-550 [overflow-wrap:anywhere]">
            Shared with the AI in every project in {organizationName}.
          </p>
        </div>
        <Button
          asChild
          variant="glass"
          size="sm"
          className="shrink-0 self-start"
        >
          <Link href={AppUrls.organizationContext(orgSlug)}>
            Open organization context
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className={SUBHEADING_CLASS}>Memory</h4>
        <OrganizationMemoryList
          organizationId={organizationId}
          organizationName={organizationName}
          canEdit={canEdit}
        />
      </div>

      <div className="space-y-2">
        <h4 className={SUBHEADING_CLASS}>Documents</h4>
        <OrganizationDocumentList
          organizationId={organizationId}
          canEdit={canEdit}
        />
      </div>
    </section>
  );
};
