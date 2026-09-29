"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, Send } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { SignupModal } from "@/components/home/signup-modal";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  type GenerateTitlesResponse,
  generateTitles,
} from "@/lib/generate-titles";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { requiresUpgrade, isLoading: isBillingLoading } = useBillingAccess();
  const { captureEvent } = useAnalytics();

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
    // refresh). Defer the decision until it loads — otherwise routing on a
    // not-yet-resolved `requiresUpgrade` could misfire the wrong flow.
    if (isBillingLoading) {
      setPendingSend(true);
      return;
    }

    routeSend();
  };

  // Fire a deferred send once billing status resolves.
  useEffect(() => {
    if (!pendingSend || isBillingLoading) {
      return;
    }
    setPendingSend(false);
    routeSend();
    // routeSend reads the latest requiresUpgrade/inputValue from closure each
    // render; we intentionally only re-run when the pending flag or loading
    // state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSend, isBillingLoading]);

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
          className={cn(
            "glass-inset flex min-h-[56px] items-end gap-4 self-stretch rounded-[18px] px-3 py-3 sm:min-h-[64px] sm:gap-6 sm:rounded-[22px] sm:px-4 sm:py-4 lg:min-h-[70px]",
            // Focus ring is an outline, not a Tailwind ring: glass-inset owns
            // box-shadow for its inner shadow, and a ring would override it.
            "outline-2 outline-transparent transition-[outline-color] duration-200 ease-out-expo",
            isFocused && "outline-brand-600/25",
          )}
        >
          {/* Textarea — self-center keeps the single-line placeholder
              vertically centered inside the min-h box; once the textarea
              grows it defines the container height and centering is moot. */}
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

          {/* Submit button */}
          <button
            type="submit"
            className="btn-primary press flex size-10 shrink-0 items-center justify-center rounded-xl"
            aria-label="Submit"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </form>

      <SignupModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        initialProjectTitle={proposedProjectTitle}
        initialOrganizationName={proposedOrganizationName}
        initialOfficeName={proposedOfficeName}
        projectDescription={inputValue}
      />

      <CheckoutModal isOpen={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
