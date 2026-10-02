"use client";

import { useEffect, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import useSWRMutation from "swr/mutation";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import {
  MAX_LANDING_UPLOADS,
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-upload/types";

import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { SignupModal } from "@/components/home/signup-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBillingAccess } from "@/hooks/use-billing-access";
import {
  formatMegabytes,
  type PromptAttachment,
  usePromptAttachments,
} from "@/hooks/use-prompt-attachments";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  type GenerateTitlesResponse,
  generateTitles,
} from "@/lib/generate-titles";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";

const ATTACH_HINT = `PDF or Word, up to ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)} each, max ${MAX_LANDING_UPLOADS} files`;

const ATTACHMENT_STATUS_LABEL: Record<PromptAttachment["status"], string> = {
  uploading: "uploading",
  uploaded: "attached",
  error: "upload failed",
};

interface SearchInputProps {
  // Styling overrides
  className?: string;

  // Content customization
  placeholder?: string;

  // Office name used when title generation returns none (or fails)
  fallbackOfficeName?: string;

  // Controlled mode (optional) — mirrors ProjectPromptInput
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function SearchInput({
  className,
  placeholder = "I'm working on restoring a small wetland area adjacent...",
  fallbackOfficeName,
  defaultValue = "",
  value,
  onValueChange,
}: SearchInputProps) {
  const ENV = getLandingPageEnv();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [proposedProjectTitle, setProposedProjectTitle] = useState("");
  const [proposedOrganizationName, setProposedOrganizationName] = useState("");
  const [proposedOfficeName, setProposedOfficeName] = useState("");
  const [pendingSend, setPendingSend] = useState(false);
  // Failed uploads already on screen when a send was deferred: the user sent
  // knowing those files are left behind. Any other failure while waiting
  // cancels the send, or the modal would cover the error and drop the file.
  const knownFailedIdsRef = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { requiresUpgrade, isLoading: isBillingLoading } = useBillingAccess();
  const { captureEvent } = useAnalytics();
  const {
    attachments,
    attachedDocuments,
    isUploading,
    notices,
    addFiles,
    removeAttachment,
  } = usePromptAttachments();

  // The whole glass box is a drop target; the paperclip opens the picker.
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: addFiles,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  // Support controlled and uncontrolled modes
  const inputValue = value !== undefined ? value : internalValue;

  const setInputValue = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // useSWRMutation for POST request
  const { trigger, isMutating } = useSWRMutation(
    `${ENV.SERVER_URL}/generate-titles`,
    generateTitles,
  );

  const openTryItModal = async () => {
    if (!inputValue.trim()) {
      return;
    }

    // Title generation is best-effort: the modal must open no matter what
    // comes back. officeTitle / organizationName are legitimately empty when
    // the server finds no matching government office, so only projectTitle
    // decides whether we use the generated titles or the raw input.
    let titles: GenerateTitlesResponse | undefined;
    try {
      titles = await trigger({ description: inputValue });
    } catch (err) {
      console.error("Error generating titles:", err);
    }
    if (titles?.error) {
      console.error("Title generation error:", titles.error);
    }

    setProposedProjectTitle(titles?.projectTitle || inputValue.slice(0, 50));
    setProposedOrganizationName(titles?.organizationName || "");
    setProposedOfficeName(titles?.officeTitle || fallbackOfficeName || "");
    setModalOpen(true);
  };

  // Route a send to the right flow under the usage-quota model. Anonymous and
  // under-quota users go straight to the normal signup/try-it flow; only an
  // authenticated, over-quota user hits the checkout wall.
  const routeSend = () => {
    if (requiresUpgrade) {
      setCheckoutOpen(true);
      return;
    }
    openTryItModal();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputValue.trim()) {
      return;
    }

    captureEvent(events.HERO_PROMPT_SUBMITTED);

    // Billing status not resolved yet (e.g. first click right after a page
    // refresh), or attached documents still uploading. Defer the decision
    // until both settle — routing on a not-yet-resolved `requiresUpgrade`
    // could misfire the wrong flow, and the modal needs the finished uploads.
    if (isBillingLoading || isUploading) {
      knownFailedIdsRef.current = new Set(
        attachments
          .filter((attachment) => attachment.status === "error")
          .map((attachment) => attachment.id),
      );
      setPendingSend(true);
      return;
    }

    routeSend();
  };

  // Fire a deferred send once billing status resolves and uploads finish.
  useEffect(() => {
    if (!pendingSend || isBillingLoading || isUploading) {
      return;
    }
    setPendingSend(false);

    const hasNewFailure = attachments.some(
      (attachment) =>
        attachment.status === "error" &&
        !knownFailedIdsRef.current.has(attachment.id),
    );
    if (hasNewFailure) {
      // Back to the composer, so the user can retry or remove the file and
      // send again.
      textareaRef.current?.focus();
      return;
    }

    routeSend();
    // routeSend and the failure check read the latest requiresUpgrade,
    // inputValue and attachments from closure each render; we intentionally
    // only re-run when the pending flag, loading or uploading state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSend, isBillingLoading, isUploading]);

  // Removing a file that is still uploading cancels a send waiting on it: the
  // user is still editing what they send, and once the last upload is gone
  // the deferred send would otherwise fire without that file. Removing a
  // finished or failed file leaves the send alone (e.g. one only waiting on
  // billing status).
  const handleRemoveAttachment = (id: string) => {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed?.status === "uploading") {
      setPendingSend(false);
    }
    removeAttachment(id);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.replace(/\n/g, " ");
    setInputValue(newValue);
  };

  const isSending = isMutating || pendingSend;

  return (
    <div
      id="project-prompt-input"
      className={cn("relative mx-auto w-full max-w-[656px]", className)}
    >
      <form onSubmit={handleSubmit}>
        <div
          {...getRootProps()}
          className={cn(
            "glass-inset relative flex min-h-[56px] flex-col gap-2.5 self-stretch rounded-[18px] px-3 py-3 sm:min-h-[64px] sm:rounded-[22px] sm:px-4 sm:py-4 lg:min-h-[70px]",
            // Focus ring is an outline, not a Tailwind ring: glass-inset owns
            // box-shadow for its inner shadow, and a ring would override it.
            "outline-2 outline-transparent transition-[outline-color] duration-200 ease-out-expo",
            isFocused && "outline-brand-600/25",
            isDragActive && "outline-dashed outline-brand-600/60",
          )}
        >
          <input {...getInputProps()} accept={PROJECT_DOCUMENT_ACCEPT} />

          {/* Stays mounted (hidden while empty) so it is a live region before
              the first chip arrives and the last chip can animate out. */}
          <ul
            aria-label="Attached documents"
            aria-live="polite"
            className="flex flex-wrap gap-1.5 text-left empty:hidden"
          >
            <AnimatePresence initial={false}>
              {attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={handleRemoveAttachment}
                />
              ))}
            </AnimatePresence>
          </ul>

          <div className="flex items-end gap-4 sm:gap-6">
            {/* Textarea — self-center keeps the single-line placeholder
                vertically centered against the buttons; once the textarea
                grows it defines the row height and centering is moot. */}
            <div className="relative flex-1 self-center">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={handleChange}
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
                onFocus={() => setIsFocused(true)}
                onBlur={(e) => {
                  if (!e.target.value) {
                    setIsFocused(false);
                  }
                }}
                placeholder={placeholder}
                className="w-full resize-none bg-transparent font-heading text-[15px] font-normal leading-[22px] tracking-normal text-egray-900 outline-hidden placeholder:text-egray-400"
                aria-label="Describe your project"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => open()}
                      className="press flex size-10 items-center justify-center rounded-xl text-egray-600 hover:bg-white/70 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-700"
                      aria-label="Attach documents"
                    >
                      <Paperclip aria-hidden className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Attach documents · {ATTACH_HINT}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Submit button */}
              <button
                type="submit"
                className="btn-primary press flex size-10 items-center justify-center rounded-xl"
                aria-label={
                  isSending && isUploading
                    ? "Submit once documents finish uploading"
                    : "Submit"
                }
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </div>

          {isDragActive && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-white/85 px-4 text-center text-[14px] font-medium text-brand-800"
            >
              Drop to attach · {ATTACH_HINT}
            </div>
          )}
        </div>
      </form>

      <ul aria-live="polite" className="mt-2 space-y-1 px-1 empty:hidden">
        {notices.map((message) => (
          <li
            key={message}
            className="flex items-start gap-1.5 text-left text-[13px] leading-5 text-error-700"
          >
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {message}
          </li>
        ))}
      </ul>

      <SignupModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        initialProjectTitle={proposedProjectTitle}
        initialOrganizationName={proposedOrganizationName}
        initialOfficeName={proposedOfficeName}
        projectDescription={inputValue}
        attachedDocuments={attachedDocuments}
      />

      <CheckoutModal isOpen={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}

interface AttachmentChipProps {
  attachment: PromptAttachment;
  onRemove: (id: string) => void;
}

function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  const { id, name, status, error } = attachment;
  const isError = status === "error";

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      title={isError ? error : name}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-[13px] leading-5",
        isError
          ? "border-error-200 bg-error-50/90 text-error-700"
          : "border-white/85 bg-white/70 text-egray-700",
      )}
    >
      {status === "uploading" && (
        <Loader2
          aria-hidden
          className="size-3.5 shrink-0 animate-spin text-egray-500 motion-reduce:animate-none"
        />
      )}
      {status === "uploaded" && (
        <FileText aria-hidden className="size-3.5 shrink-0 text-brand-800" />
      )}
      {isError && <AlertCircle aria-hidden className="size-3.5 shrink-0" />}
      <span aria-hidden className="max-w-[160px] truncate sm:max-w-[220px]">
        {name}
      </span>
      {/* One text node per chip, so a status change is announced together
          with the file it belongs to. */}
      <span className="sr-only">{`${name}, ${ATTACHMENT_STATUS_LABEL[status]}`}</span>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label={`Remove ${name}`}
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-egray-500 hover:bg-white hover:text-egray-900 focus-visible:outline-2 focus-visible:outline-brand-700"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </motion.li>
  );
}
