"use client";

import { useRef, useState } from "react";

import { motion } from "framer-motion";
import { ArrowRight, BookmarkCheck, Info, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button } from "@wildfires-org/turboplan-utils";

import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { useUser } from "@/components/providers/user-provider";
import { useOrganizationMemories } from "@/hooks/use-organization-memories";
import { AppUrls } from "@/lib/nav/urls";
import {
  getSavedOrganizationMemory,
  type SavedOrganizationMemory,
} from "@/lib/organization-memories";
import { cn } from "@/lib/utils";

interface OrganizationMemoryCardProps {
  /** The tool output once the call finished; undefined while it runs */
  result?: Record<string, unknown>;
  /** Shared/read-only chat: no actions */
  isReadonly: boolean;
}

interface SavedMemoryCardProps {
  saved: SavedOrganizationMemory;
  isReadonly: boolean;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const MUTED_ROW_CLASS =
  "flex items-center gap-2 text-[13px] leading-5 text-gray-550 [&_svg]:size-4 [&_svg]:shrink-0";

const ACTION_BUTTON_CLASS =
  "h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-550 hover:bg-white/80 hover:text-foreground dark:hover:bg-white/10 [&_svg]:size-3.5";

/**
 * The `saveOrganizationMemory` tool in the chat: a muted "Saving..." row while
 * it runs, then a card with the saved note, a one-click Delete and a link to
 * the project's Context page (where every note is listed). Rendered from the
 * persisted output, so it reads the same when the chat is reloaded.
 */
export const OrganizationMemoryCard = ({
  result,
  isReadonly,
}: OrganizationMemoryCardProps) => {
  const organizationName = useOptionalDashboard()?.organization?.name;

  if (!result) {
    return (
      <p role="status" className={MUTED_ROW_CLASS}>
        <Loader2
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
        Saving to {organizationName ?? "organization"} context…
      </p>
    );
  }

  const saved = getSavedOrganizationMemory(result);
  if (!saved) {
    // The assistant explains what went wrong in its reply.
    return (
      <p className={MUTED_ROW_CLASS}>
        <Info aria-hidden />
        Not saved to the organization context
      </p>
    );
  }

  return <SavedMemoryCard saved={saved} isReadonly={isReadonly} />;
};

const SavedMemoryCard = ({ saved, isReadonly }: SavedMemoryCardProps) => {
  const dashboard = useOptionalDashboard();
  const { user } = useUser();
  const cardRef = useRef<HTMLDivElement>(null);

  const organization = dashboard?.organization ?? null;
  const office = dashboard?.office ?? null;
  const project = dashboard?.project ?? null;
  const organizationId = isReadonly ? null : (organization?.id ?? null);

  const { hasPermission: canEditOrganization } = useEntityPermission({
    userId: organizationId ? user?.id : undefined,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId ?? "",
    action: Action.UPDATE,
  });
  const { memories, deleteMemory } = useOrganizationMemories(organizationId);
  const [isDeleting, setIsDeleting] = useState(false);

  // "Deleted" only once the note was seen in the list and then left it (here
  // or anywhere else). A note missing from a list that may predate it (a
  // cached fetch from before this save) just gets no Delete button.
  const isListed = memories.some((memory) => memory.id === saved.memory.id);
  const [wasListed, setWasListed] = useState(false);
  if (isListed && !wasListed) {
    setWasListed(true);
  }
  const isDeleted = wasListed && !isListed;
  const canDelete = canEditOrganization && isListed && !isDeleting;

  const manageHref =
    !isReadonly && organization && office && project
      ? AppUrls.projectContext(organization.slug, office.slug, project.slug)
      : null;

  const handleDelete = async () => {
    // The button is about to go: keep focus on the card.
    cardRef.current?.focus();
    setIsDeleting(true);
    await deleteMemory(saved.memory.id);
    setIsDeleting(false);
  };

  const title =
    saved.status === "already_saved"
      ? `Already in ${saved.organizationName} context`
      : `Saved to ${saved.organizationName} context`;

  return (
    <motion.div
      ref={cardRef}
      tabIndex={-1}
      data-testid="organization-memory-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="glass-card w-full max-w-md rounded-2xl px-3.5 pb-2 pt-3 outline-none"
    >
      <p className="flex items-start gap-1.5 text-[13px] font-medium leading-5 text-brand-800 dark:text-brand-300">
        <BookmarkCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
      </p>
      <p
        className={cn(
          "mt-1.5 whitespace-pre-line text-sm leading-6 [overflow-wrap:anywhere]",
          isDeleted
            ? "text-gray-550 line-through decoration-gray-550/50"
            : "text-foreground",
        )}
      >
        {saved.memory.content}
      </p>
      <span aria-live="polite" className="sr-only">
        {isDeleted ? "Note deleted" : ""}
      </span>

      {(manageHref || canDelete || isDeleted) && (
        <div className="-ml-2 mt-1 flex min-h-8 flex-wrap items-center gap-1">
          {isDeleted && (
            <span className="px-2 text-xs leading-5 text-gray-550">
              Deleted
            </span>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className={cn(ACTION_BUTTON_CLASS, "hover:text-error-700")}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          )}
          {manageHref && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={ACTION_BUTTON_CLASS}
            >
              <Link href={manageHref}>
                Manage
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};
