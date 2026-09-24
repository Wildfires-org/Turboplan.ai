import type { MouseEvent } from "react";

import { FileArchive, MapPin, X } from "lucide-react";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";

import { LoaderIcon } from "./icons";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onClick,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const canRemove = Boolean(onRemove) && !isUploading;

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove?.();
  };

  const content = (
    <>
      <div className="relative flex aspect-video h-16 w-20 flex-col items-center justify-center overflow-hidden rounded-xl border border-white/90 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_20px_-14px_rgba(21,102,71,0.35)] dark:border-white/10 dark:bg-slate-900/60">
        {contentType ? (
          contentType.startsWith("image") ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? "An image attachment"}
              className="size-full object-cover"
            />
          ) : contentType === "application/zip" ||
            contentType === "application/x-zip-compressed" ||
            contentType === "application/octet-stream" ||
            name?.toLowerCase().endsWith(".zip") ? (
            <div className="flex flex-col items-center justify-center text-brand-800">
              <MapPin className="size-6 mb-1" />
              <FileArchive className="size-4" />
            </div>
          ) : (
            <div className="flex items-center justify-center text-brand-800">
              <FileArchive className="size-6" />
            </div>
          )
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div
            data-testid="input-attachment-loader"
            className="absolute animate-spin text-gray-550"
          >
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="max-w-16 truncate text-xs text-gray-550" title={name}>
        {name}
      </div>
    </>
  );

  const preview = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-testid="input-attachment-preview"
      className="press -m-1 flex flex-col gap-2 rounded-xl p-1 text-left hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
    >
      {content}
    </button>
  ) : (
    <div data-testid="input-attachment-preview" className="flex flex-col gap-2">
      {content}
    </div>
  );

  if (!canRemove) {
    return preview;
  }

  // The remove button is a sibling of the (possibly clickable) preview so we
  // never nest one button inside another.
  return (
    <div className="relative">
      {preview}
      <button
        type="button"
        onClick={handleRemove}
        aria-label="Remove attachment"
        data-testid="input-attachment-remove"
        className="glass press absolute right-0.5 top-0.5 z-10 flex size-5 items-center justify-center rounded-full text-gray-550 hover:bg-white hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  );
};
