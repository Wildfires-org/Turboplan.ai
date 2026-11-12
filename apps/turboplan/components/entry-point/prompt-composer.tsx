"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  AlertCircle,
  ArrowRight,
  FileText,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { posthog } from "posthog-js";
import { useDropzone } from "react-dropzone";

import {
  MAX_LANDING_UPLOADS,
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-upload/types";

import {
  formatMegabytes,
  type PromptAttachment,
  usePromptAttachments,
} from "@/hooks/use-prompt-attachments";
import {
  buildSelfServiceHandoffUrl,
  proposeProjectTitle,
} from "@/lib/entry-point/handoff";
import type { EntryExample } from "@/lib/entry-point/types";
import { parseSignupAttribution } from "@/lib/signup-attribution";
import { cn } from "@/lib/utils";
import { ExampleChips } from "./example-chips";

interface PromptComposerProps {
  placeholder: string;
  examplesLabel: string;
  examples: EntryExample[];
  /** `?projectDescription=` on the entry URL, the landing page's prefill. */
  initialPrompt?: string;
}

// "waiting": sent while documents upload; "leaving": on the way to signup.
type SendStatus = "idle" | "waiting" | "leaving";

type PromptDraft = { prompt: string; exampleId?: string };

// The prompt last sent from this tab, so Back from the signup form finds it.
const DRAFT_STORAGE_KEY = "entry-prompt-draft";

const ATTACH_HINT = `PDF or Word, up to ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)} each, ${MAX_LANDING_UPLOADS} files at most.`;

const ATTACHMENT_STATUS_LABEL: Record<PromptAttachment["status"], string> = {
  uploading: "uploading",
  uploaded: "attached",
  error: "upload failed",
};

const readDraft = (): PromptDraft | null => {
  try {
    const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PromptDraft) : null;
  } catch {
    return null;
  }
};

const saveDraft = (draft: PromptDraft) => {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked (private mode): Back simply starts empty.
  }
};

/**
 * The entry page's prompt box. Sending hands the prompt, a proposed project
 * name and any attached documents to the self-service signup
 * (lib/entry-point/handoff.ts), which asks for an email, sends the sign-in
 * link and creates the project.
 */
export function PromptComposer({
  placeholder,
  examplesLabel,
  examples,
  initialPrompt = "",
}: PromptComposerProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [example, setExample] = useState<EntryExample>();
  const [isPromptMissing, setIsPromptMissing] = useState(false);
  const [status, setStatus] = useState<SendStatus>("idle");
  // Failed uploads already on screen when a send was deferred: the visitor
  // sent knowing those files stay behind. A new failure while waiting cancels
  // the send instead, so the error is seen before leaving.
  const knownFailedIdsRef = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const promptId = useId();
  const errorId = useId();
  const attachHintId = useId();

  const {
    attachments,
    uploadedKeys,
    isUploading,
    notices,
    addFiles,
    removeAttachment,
  } = usePromptAttachments();

  // The whole card is a drop target; the Attach button opens the picker.
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: addFiles,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  useEffect(() => {
    if (initialPrompt) {
      return;
    }
    const draft = readDraft();
    if (!draft?.prompt) {
      return;
    }
    setPrompt(draft.prompt);
    setExample(examples.find((candidate) => candidate.id === draft.exampleId));
  }, [initialPrompt, examples]);

  // Grow with the text up to the CSS max height, then scroll.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [prompt]);

  const handOff = () => {
    const attribution = parseSignupAttribution(
      new URLSearchParams(window.location.search),
    );
    // Lets the signup alias this anonymous visitor to the new account, as
    // the landing page's handoff does.
    const distinctId = posthog.__loaded ? posthog.get_distinct_id() : "";
    const href = buildSelfServiceHandoffUrl({
      prompt,
      projectTitle: proposeProjectTitle(prompt, example),
      uploadKeys: uploadedKeys,
      attribution: distinctId
        ? { ...attribution, ph_did: distinctId }
        : attribution,
    });
    saveDraft({ prompt, exampleId: example?.id });
    setStatus("leaving");
    router.push(href);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "idle") {
      return;
    }
    if (!prompt.trim()) {
      setIsPromptMissing(true);
      textareaRef.current?.focus();
      return;
    }
    if (isUploading) {
      knownFailedIdsRef.current = new Set(
        attachments
          .filter((attachment) => attachment.status === "error")
          .map((attachment) => attachment.id),
      );
      setStatus("waiting");
      return;
    }
    handOff();
  };

  // A send that waited on uploads goes out once they finish.
  useEffect(() => {
    if (status !== "waiting" || isUploading) {
      return;
    }
    const hasNewFailure = attachments.some(
      (attachment) =>
        attachment.status === "error" &&
        !knownFailedIdsRef.current.has(attachment.id),
    );
    if (hasNewFailure) {
      setStatus("idle");
      textareaRef.current?.focus();
      return;
    }
    handOff();
    // handOff reads the latest prompt and uploads from this render; only the
    // end of the wait should trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isUploading]);

  // Removing a file that is still uploading cancels a send waiting on it: the
  // visitor is still deciding what to send.
  const handleRemoveAttachment = (id: string) => {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed?.status === "uploading" && status === "waiting") {
      setStatus("idle");
    }
    removeAttachment(id);
  };

  const handleSelectExample = (selected: EntryExample) => {
    setPrompt(selected.prompt);
    setExample(selected);
    setIsPromptMissing(false);

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.focus();
    // After React has rendered the new value, so the caret lands at its end.
    requestAnimationFrame(() => {
      textarea.setSelectionRange(
        selected.prompt.length,
        selected.prompt.length,
      );
    });
  };

  const isBusy = status !== "idle";
  const sendLabel =
    status === "waiting"
      ? "Uploading…"
      : status === "leaving"
        ? "Opening…"
        : "Start planning";

  return (
    <div>
      <form noValidate onSubmit={handleSubmit} aria-busy={isBusy}>
        <div
          {...getRootProps({
            className: cn(
              "relative rounded-[20px] bg-white text-left ring-1 ring-black/[0.07] transition-shadow duration-200",
              "shadow-[0_1px_2px_rgba(11,13,15,0.04),0_32px_56px_-36px_rgba(11,13,15,0.45)]",
              // The card, not the textarea, shows focus; red wins while the
              // prompt is missing.
              isPromptMissing
                ? "ring-2 ring-error-600"
                : "has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-brand-500",
              isDragActive && "ring-2 ring-brand-500",
            ),
          })}
        >
          <input
            {...getInputProps({ "aria-label": "Attach documents" })}
            accept={PROJECT_DOCUMENT_ACCEPT}
          />
          <label htmlFor={promptId} className="sr-only">
            Describe your project
          </label>
          <textarea
            ref={textareaRef}
            id={promptId}
            // A send before hydration is a native GET to `/`; named like the
            // prefill param, the text comes back in the box.
            name="projectDescription"
            rows={3}
            value={prompt}
            placeholder={placeholder}
            aria-invalid={isPromptMissing || undefined}
            aria-describedby={isPromptMissing ? errorId : undefined}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (event.target.value.trim()) {
                setIsPromptMissing(false);
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            // 16px+ on phones: iOS Safari zooms into smaller fields on focus.
            className="block max-h-[40vh] min-h-[104px] w-full resize-none overflow-y-auto bg-transparent px-5 pt-5 text-[17px] leading-[1.55] text-gray-950 placeholder:text-gray-350 focus:[outline:none] sm:px-6 sm:pt-6 sm:text-[18px]"
          />

          {/* Stays mounted while empty, so it is a live region before the
              first file arrives. */}
          <ul
            aria-label="Attached documents"
            aria-live="polite"
            className="flex flex-wrap gap-1.5 px-4 pt-3 empty:hidden sm:px-5"
          >
            {attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={handleRemoveAttachment}
              />
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <button
              type="button"
              onClick={open}
              aria-describedby={attachHintId}
              className="inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium text-gray-550 transition-colors hover:bg-brandAlt-100 hover:text-gray-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Paperclip aria-hidden className="size-4" />
              Attach
            </button>
            <span id={attachHintId} className="sr-only">
              {ATTACH_HINT}
            </span>

            <button
              type="submit"
              disabled={status === "leaving"}
              className="btn-primary press inline-flex h-11 items-center gap-2 rounded-full pl-5 pr-4 text-[15px] font-medium disabled:opacity-80"
            >
              {sendLabel}
              {isBusy ? (
                <Loader2
                  aria-hidden
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ArrowRight aria-hidden className="size-4" />
              )}
            </button>
          </div>

          {isDragActive && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-white/90 px-6 text-center text-[15px] font-medium text-gray-950"
            >
              Drop to attach · {ATTACH_HINT}
            </div>
          )}
        </div>
      </form>

      <div aria-live="polite" className="mt-3 space-y-1 px-1 empty:hidden">
        {isPromptMissing && (
          <FieldNotice id={errorId}>
            Describe your project to get started, or pick an example below.
          </FieldNotice>
        )}
        {notices.map((message) => (
          <FieldNotice key={message}>{message}</FieldNotice>
        ))}
      </div>

      <div className="mt-10 sm:mt-12">
        <ExampleChips
          label={examplesLabel}
          examples={examples}
          onSelect={handleSelectExample}
        />
      </div>
    </div>
  );
}

interface AttachmentChipProps {
  attachment: PromptAttachment;
  onRemove: (id: string) => void;
}

const AttachmentChip = ({ attachment, onRemove }: AttachmentChipProps) => {
  const { id, name, status, error } = attachment;
  const isError = status === "error";

  return (
    <li
      title={isError ? error : name}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[13px] leading-5 ring-1",
        isError
          ? "bg-error-50 text-error-700 ring-error-200"
          : "bg-brandAlt-100 text-gray-950 ring-black/[0.08]",
      )}
    >
      {status === "uploading" && (
        <Loader2
          aria-hidden
          className="size-3.5 shrink-0 animate-spin text-gray-550 motion-reduce:animate-none"
        />
      )}
      {status === "uploaded" && (
        <FileText aria-hidden className="size-3.5 shrink-0 text-brand-700" />
      )}
      {isError && <AlertCircle aria-hidden className="size-3.5 shrink-0" />}
      <span aria-hidden className="max-w-[180px] truncate sm:max-w-[260px]">
        {name}
      </span>
      {/* One text node per chip, so a status change is announced with the
          file it belongs to. */}
      <span className="sr-only">{`${name}, ${ATTACHMENT_STATUS_LABEL[status]}`}</span>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label={`Remove ${name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-550 hover:bg-white hover:text-gray-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
};

interface FieldNoticeProps {
  id?: string;
  children: React.ReactNode;
}

const FieldNotice = ({ id, children }: FieldNoticeProps) => {
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-left text-[14px] leading-5 text-error-700"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
};
