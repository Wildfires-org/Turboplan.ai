"use client";

import type React from "react";
import {
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { UIMessage } from "ai";
import cx from "classnames";
import equal from "fast-deep-equal";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-documents/client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import { Button, Textarea } from "@wildfires-org/turboplan-utils";

import type { ChatHelpers } from "@/hooks/use-chat-compat";
import { registerProjectDocument } from "@/lib/project-documents";
import { ArrowUpIcon, PaperclipIcon, StopIcon } from "../icons";
import { PreviewAttachment } from "../preview-attachment";

const apiClient = new ApiClient();

// A successfully uploaded file paired with the resulting chat attachment.
// `pathname` is the R2 storage path — kept separate from the attachment so the
// attachment can carry the user-facing filename.
type UploadedFile = { file: File; attachment: Attachment; pathname: string };

// Only PDF/Word documents within the project-document size limit are mirrored
// into the project's Documents list; everything else stays a chat-only attachment.
const isProjectDocument = (file: File): boolean =>
  Object.keys(ALLOWED_MIME_TYPES).includes(file.type) &&
  file.size <= MAX_FILE_SIZE;

// Dragging text or a link also fires drag events — only files should open the
// dropzone overlay.
const hasDraggedFiles = (event: DragEvent<HTMLElement>): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

function PureProjectMultimodalInput({
  input,
  projectId,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  handleSubmit,
  className,
  isInputDisabled,
  disabledPlaceholder,
}: {
  chatId: string;
  projectId?: string;
  input: ChatHelpers["input"];
  setInput: ChatHelpers["setInput"];
  status: ChatHelpers["status"];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: ChatHelpers["setMessages"];
  append: ChatHelpers["append"];
  handleSubmit: ChatHelpers["handleSubmit"];
  className?: string;
  isInputDisabled?: boolean;
  disabledPlaceholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  // Use the new upload hook with 100MB limit for project files (larger than chat)
  const { upload } = useFileUpload({
    maxSize: 100 * 1024 * 1024, // 100MB - project files may be larger
    onError: (error) => {
      toast.error(error.message || "Failed to upload file, please try again!");
    },
  });

  const submitForm = useCallback(() => {
    // Prevent submission if model is busy
    if (status !== "ready") {
      toast.error("Please wait for the model to finish its response!");
      return;
    }

    // No navigation - removed the window.history.replaceState call

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    resetHeight();

    textareaRef.current?.focus();
  }, [attachments, handleSubmit, setAttachments, status]);

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "44px";
    }
  };

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | undefined> => {
      try {
        const result = await upload(file);

        return {
          file,
          attachment: {
            url: result.url,
            name: file.name,
            contentType: result.contentType,
          },
          pathname: result.pathname,
        };
      } catch (_error) {
        // Error already handled by onError callback in hook options
        return undefined;
      }
    },
    [upload],
  );

  // Mirror document-type uploads (already stored in R2 by the chat upload) into
  // the project's Documents list. Never blocks or fails the chat attachment.
  const persistProjectDocuments = useCallback(
    async (uploads: Array<UploadedFile>) => {
      if (!projectId) {
        return;
      }

      // Dedupe by File identity so the same file isn't posted twice in one go.
      const seenFiles = new Set<File>();
      const documentUploads = uploads.filter(({ file }) => {
        if (seenFiles.has(file) || !isProjectDocument(file)) {
          return false;
        }
        seenFiles.add(file);
        return true;
      });

      if (documentUploads.length === 0) {
        return;
      }

      // Skip files already in the project's Documents list, matched by
      // name + size (same heuristic as the add-project dropzone) — re-attaching
      // a file in a later message must not create duplicate document rows.
      // Best-effort: if the lookup fails, register anyway.
      const { data: existingDocuments } = await apiClient.get<
        Array<{ originalFilename: string; size: number }>
      >(
        `/api/project-documents?projectId=${encodeURIComponent(projectId)}&source=upload`,
      );
      const existingKeys = new Set(
        (existingDocuments ?? []).map(
          (doc) => `${doc.originalFilename}:${doc.size}`,
        ),
      );
      const newUploads = documentUploads.filter(
        ({ file }) => !existingKeys.has(`${file.name}:${file.size}`),
      );

      if (newUploads.length === 0) {
        return;
      }

      let persistedCount = 0;

      for (const { file, attachment, pathname } of newUploads) {
        const registered = await registerProjectDocument(apiClient, {
          projectId,
          file,
          url: attachment.url,
          pathname,
        });

        if (registered) {
          persistedCount += 1;
        }
      }

      if (persistedCount > 0) {
        toast.success("Added to project documents");
        await mutate(
          `/api/project-documents?projectId=${encodeURIComponent(projectId)}&source=upload`,
        );
      }
    },
    [projectId],
  );

  // Shared upload path for both the paperclip file picker and drag-and-drop.
  const processFiles = useCallback(
    async (files: Array<File>) => {
      if (files.length === 0) {
        return;
      }

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadResults = await Promise.all(
          files.map((file) => uploadFile(file)),
        );
        const successfulUploads = uploadResults.filter(
          (result): result is UploadedFile => result !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfulUploads.map((result) => result.attachment),
        ]);
        // Clear the queue in the same commit as the attachments, otherwise the
        // spinner tile and the finished tile render side by side for the whole
        // duration of the (slow) project-document persistence below.
        setUploadQueue([]);

        await persistProjectDocuments(successfulUploads);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile, persistProjectDocuments],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      await processFiles(Array.from(event.target.files || []));
    },
    [processFiles],
  );

  // Removes the attachment from the outgoing message only; any mirrored
  // project document stays untouched.
  const handleRemoveAttachment = useCallback(
    (url: string) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter((attachment) => attachment.url !== url),
      );
    },
    [setAttachments],
  );

  // Nested children fire their own dragenter/dragleave pairs, so a plain boolean
  // flickers. Counting enters/leaves keeps the overlay stable while dragging.
  const dragDepthRef = useRef(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const isUploadDisabled = status !== "ready" || Boolean(isInputDisabled);

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (isUploadDisabled || !hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (isUploadDisabled || !hasDraggedFiles(event)) {
      return;
    }
    // Required for the drop event to fire at all.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (isUploadDisabled || !hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    if (isUploadDisabled) {
      return;
    }

    await processFiles(Array.from(event.dataTransfer.files));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitForm();
    }
  };

  // Track previous status to detect AI completion
  const prevStatusRef = useRef(status);

  // Restore focus when AI finishes responding
  useEffect(() => {
    // Only restore focus when transitioning from busy state to ready
    if (
      prevStatusRef.current !== "ready" &&
      status === "ready" &&
      textareaRef.current
    ) {
      textareaRef.current.focus();
    }

    // Always update the ref
    prevStatusRef.current = status;
  }, [status]);

  const isLoading = status === "streaming";

  // The input can be disabled mid-drag (model starts streaming) — drop the
  // overlay so it can't get stuck.
  useEffect(() => {
    if (isUploadDisabled) {
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    }
  }, [isUploadDisabled]);

  return (
    // Drag-and-drop is a pointer-only affordance; the paperclip button remains
    // the keyboard-accessible equivalent.
    <div
      className="relative w-full flex flex-col gap-4"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-auto">
          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.url}
              attachment={attachment}
              onRemove={() => handleRemoveAttachment(attachment.url)}
            />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: "",
                name: filename,
                contentType: "",
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        placeholder={
          isInputDisabled
            ? (disabledPlaceholder ?? "Send a message...")
            : "Send a message..."
        }
        value={input}
        onChange={handleInput}
        className={cx(
          "max-h-[calc(75dvh)] min-h-[44px] resize-none overflow-hidden rounded-xl py-2.5 pr-20 text-base",
          isInputDisabled && "opacity-60 cursor-not-allowed",
          className,
        )}
        rows={1}
        autoFocus={!isInputDisabled}
        onKeyDown={handleKeyDown}
        disabled={isLoading || isInputDisabled}
      />
      {isLoading ? (
        <Button
          type="button"
          className="size-7 p-0 absolute bottom-2 right-2 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            stop();
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <>
          <input
            type="file"
            className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
            ref={fileInputRef}
            multiple
            onChange={handleFileChange}
            tabIndex={-1}
          />

          <Button
            type="button"
            aria-label="Attach files"
            className="absolute bottom-2 right-10 size-7 rounded-lg p-0 text-foreground"
            onClick={() => fileInputRef.current?.click()}
            variant="glass"
            disabled={status !== "ready" || isInputDisabled}
          >
            <PaperclipIcon size={14} />
          </Button>

          <Button
            type="button"
            aria-label="Send message"
            variant="brand"
            className="absolute bottom-2 right-2 size-7 rounded-lg p-0"
            onClick={(event) => {
              event.preventDefault();
              submitForm();
            }}
            disabled={
              input.length === 0 || uploadQueue.length > 0 || isInputDisabled
            }
          >
            <ArrowUpIcon size={14} />
          </Button>
        </>
      )}

      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-700 bg-brand-50/90">
          <Upload className="size-4 text-brand-800" />
          <span className="text-sm font-medium text-brand-800">
            Drop files to upload
          </span>
        </div>
      )}
    </div>
  );
}

export const ProjectMultimodalInput = memo(
  PureProjectMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.projectId !== nextProps.projectId) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.messages.length !== nextProps.messages.length) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.isInputDisabled !== nextProps.isInputDisabled) return false;
    if (prevProps.disabledPlaceholder !== nextProps.disabledPlaceholder)
      return false;

    return true;
  },
);

ProjectMultimodalInput.displayName = "ProjectMultimodalInput";
