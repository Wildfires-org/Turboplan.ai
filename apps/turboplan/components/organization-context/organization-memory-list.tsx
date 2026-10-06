"use client";

import { useRef, useState } from "react";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import { ORGANIZATION_MEMORIES_MAX } from "@wildfires-org/turboplan-workspace/types";

import { useOrganizationMemories } from "@/hooks/use-organization-memories";
import { EMPTY_STATE_TEXT_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import { formatShortDate } from "@/lib/organization-context";
import { formatRelativeTime } from "@/lib/organization-memories";
import { cn } from "@/lib/utils";
import type { OrganizationMemory } from "@/types/organization-context";

interface OrganizationMemoryListProps {
  organizationId: string;
  organizationName: string;
  /** Owner or editor (organization UPDATE): delete notes */
  canEdit: boolean;
}

interface MemoryRowProps {
  memory: OrganizationMemory;
  canDelete: boolean;
  onDelete: (memory: OrganizationMemory) => void;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const ROW_CLASS =
  "group flex items-start gap-2 rounded-xl border border-white/90 bg-white/70 py-2.5 pl-3 pr-1.5 dark:border-white/10 dark:bg-slate-900/50";

// Always visible on touch screens; on devices that hover, shown on row hover
// or keyboard focus.
const DELETE_BUTTON_CLASS =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-gray-550 transition-[opacity,color,background-color] duration-150 hover:bg-white hover:text-error-700 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:hover:bg-white/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100";

/**
 * The notes the chat assistant saved to the organization, newest first.
 * Owners and editors delete a note with one click (no confirmation: notes are
 * one line, and the assistant can save them again).
 */
export const OrganizationMemoryList = ({
  organizationId,
  organizationName,
  canEdit,
}: OrganizationMemoryListProps) => {
  const { memories, isLoading, hasError, deleteMemory } =
    useOrganizationMemories(organizationId);
  const listRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  const handleDelete = async (memory: OrganizationMemory) => {
    // The row and its button are about to go: keep focus in the list.
    listRef.current?.focus();
    const isDeleted = await deleteMemory(memory.id);
    if (isDeleted) {
      setAnnouncement("Note deleted");
    }
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading notes" className="space-y-2">
        {[0, 1].map((index) => (
          <div key={index} className={cn(ROW_CLASS, "flex-col gap-2 pr-3")}>
            <span className={cn(SKELETON_BAR_CLASS, "block h-4 w-3/4")} />
            <span className={cn(SKELETON_BAR_CLASS, "block h-3 w-20")} />
          </div>
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <p className="text-[13px] leading-5 text-error-700">
        Could not load the notes. Reload the page to try again.
      </p>
    );
  }

  const isFull = memories.length >= ORGANIZATION_MEMORIES_MAX;

  return (
    <div ref={listRef} tabIndex={-1} className="space-y-2 outline-none">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {memories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-900/10 px-4 py-6 text-center dark:border-white/10">
          <p
            className={cn(
              EMPTY_STATE_TEXT_CLASS,
              "mx-auto max-w-md [overflow-wrap:anywhere]",
            )}
          >
            Nothing saved yet. Ask the assistant to remember something about{" "}
            {organizationName} in any project chat.
          </p>
        </div>
      ) : (
        <>
          <p
            className={cn(
              "text-xs leading-5",
              isFull ? "font-medium text-foreground" : "text-gray-550",
            )}
          >
            <span className="tabular-nums">
              {memories.length} / {ORGANIZATION_MEMORIES_MAX}
            </span>{" "}
            notes
            {isFull &&
              ". Full: delete a note so the assistant can save new ones."}
          </p>
          <MotionConfig reducedMotion="user">
            <ul aria-label="Saved notes" className="space-y-2">
              <AnimatePresence initial={false}>
                {memories.map((memory) => (
                  <MemoryRow
                    key={memory.id}
                    memory={memory}
                    canDelete={canEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </MotionConfig>
        </>
      )}
    </div>
  );
};

const MemoryRow = ({ memory, canDelete, onDelete }: MemoryRowProps) => {
  const savedAt = formatRelativeTime(memory.createdAt, Date.now());

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className={cn(ROW_CLASS, !canDelete && "pr-3")}
    >
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
          {memory.content}
        </p>
        {savedAt && (
          <time
            dateTime={memory.createdAt}
            title={formatShortDate(memory.createdAt) ?? undefined}
            className="text-xs leading-5 text-gray-550"
          >
            Saved {savedAt}
          </time>
        )}
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(memory)}
          aria-label="Delete note"
          title="Delete note"
          className={DELETE_BUTTON_CLASS}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
    </motion.li>
  );
};
