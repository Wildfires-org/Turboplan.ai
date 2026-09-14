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
      <div className="w-20 h-16 aspect-video rounded-md relative flex flex-col items-center justify-center border border-emerald-100/60 bg-gradient-to-br from-emerald-50/50 via-emerald-100/40 to-emerald-200/30">
        {contentType ? (
          contentType.startsWith("image") ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? "An image attachment"}
              className="rounded-md size-full object-cover"
            />
          ) : contentType === "application/zip" ||
            contentType === "application/x-zip-compressed" ||
            contentType === "application/octet-stream" ||
            name?.toLowerCase().endsWith(".zip") ? (
            <div className="flex flex-col items-center justify-center text-emerald-600">
              <MapPin className="size-6 mb-1" />
              <FileArchive className="size-4" />
            </div>
          ) : (
            <div className="flex items-center justify-center text-emerald-600">
              <FileArchive className="size-6" />
            </div>
          )
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div
            data-testid="input-attachment-loader"
            className="animate-spin absolute text-zinc-500"
          >
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate" title={name}>
        {name}
      </div>
    </>
  );

  const preview = onClick ? (
    <button
      type="button"
      onClick={onClick}
      data-testid="input-attachment-preview"
      className="flex flex-col gap-2 text-left rounded-md transition-colors hover:bg-muted/40 p-1 -m-1"
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
        className="absolute top-0.5 right-0.5 z-10 flex items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm size-5 transition-colors hover:bg-muted/40 hover:text-foreground/70"
      >
        <X className="size-3" />
      </button>
    </div>
  );
};
