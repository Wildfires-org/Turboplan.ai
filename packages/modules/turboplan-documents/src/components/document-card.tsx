"use client";

import type { ReactNode } from "react";

import { User } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  cn,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import { formatDateTime, getFileTypeLabel } from "./utils";

interface DocumentCardBase {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface DocumentCardUploader {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface EditableDocumentCardData extends DocumentCardBase {
  uploader?: DocumentCardUploader | null;
}

interface DocumentCardEditableProps {
  document: EditableDocumentCardData;
  actions?: ReactNode;
  onClick?: () => void;
}

interface DocumentCardReadOnlyProps {
  document: DocumentCardBase;
  onClick?: (document: DocumentCardBase) => void;
}

export function DocumentCardEditable({
  document,
  actions,
  onClick,
}: DocumentCardEditableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/90 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900/60",
        onClick &&
          "cursor-pointer transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:hover:bg-slate-900/80",
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
            {document.originalFilename}
          </p>

          <div className="flex items-center gap-3">
            <Avatar className="size-5">
              <AvatarFallback className="bg-gray-100 text-[8px] text-muted-foreground">
                {document.uploader ? (
                  generateInitials({
                    firstName: document.uploader.firstName,
                    lastName: document.uploader.lastName,
                    email: document.uploader.email,
                  })
                ) : (
                  <User className="size-3 text-muted-foreground" />
                )}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(document.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-slate-900/[0.06]">
            {getFileTypeLabel(document.mimeType)}
          </span>
          {actions}
        </div>
      </div>
    </div>
  );
}

export function DocumentCardReadOnly({
  document,
  onClick,
}: DocumentCardReadOnlyProps) {
  const cardContent = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
          {document.originalFilename}
        </p>

        <div className="flex items-center gap-3">
          <Avatar className="size-5">
            <AvatarFallback className="bg-gray-100 text-[8px] text-muted-foreground">
              <User className="size-3 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(document.createdAt)}
          </span>
        </div>
      </div>

      <div className="mt-0.5 flex shrink-0 items-start gap-2">
        <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-slate-900/[0.06]">
          {getFileTypeLabel(document.mimeType)}
        </span>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(document)}
        className={cn(
          "block w-full overflow-hidden rounded-lg border border-border bg-[#F7FAFF] p-4 text-left shadow-sm",
          "transition-all hover:border-primary/30 hover:shadow",
        )}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <a
      href={document.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block overflow-hidden rounded-lg border border-border bg-[#F7FAFF] p-4 shadow-sm",
        "transition-all hover:border-primary/30 hover:shadow",
      )}
    >
      {cardContent}
    </a>
  );
}
