"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, MessageSquareTextIcon } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import { cn } from "@wildfires-org/turboplan-utils";

import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { SignupModal } from "@/components/home/signup-modal";
import Arrow from "@/components/icons/arrow";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { generateTitles } from "@/lib/generate-titles";

interface ProjectPromptInputProps {
  // Input variant (default: "textarea")
  variant?: "input" | "textarea";

  // Styling overrides
  className?: string;
  inputClassName?: string;

  // Content customization
  placeholder?: string;
  label?: string;
  quickStart?: Record<string, string>;

  // Fallback value for office name on API error
  fallbackOfficeName?: string;

  // Controlled mode (optional)
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function ProjectPromptInput({
  variant = "textarea",
  className,
  inputClassName,
  placeholder = "I'm working on restoring a small wetland area adjacent...",
  label,
  quickStart,
  fallbackOfficeName,
  defaultValue = "",
  value,
  onValueChange,
}: ProjectPromptInputProps) {
  const ENV = getLandingPageEnv();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [proposedProjectTitle, setProposedProjectTitle] = useState("");
  const [proposedOrganizationName, setProposedOrganizationName] = useState("");
  const [proposedOfficeName, setProposedOfficeName] = useState("");
  const [pendingSend, setPendingSend] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { requiresUpgrade, isLoading: isBillingLoading } = useBillingAccess();

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
    if (variant === "textarea" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [inputValue, variant]);

  // useSWRMutation for POST request
  const { trigger, isMutating } = useSWRMutation(
    `${ENV.SERVER_URL}/generate-titles`,
    generateTitles,
  );

  const openTryItModal = async () => {
    if (!inputValue.trim()) {
      return;
    }

    try {
      const result = await trigger({ description: inputValue });

      if (result?.projectTitle && result?.officeTitle) {
        setProposedProjectTitle(result.projectTitle);
        setProposedOrganizationName(result.organizationName || "");
        setProposedOfficeName(result.officeTitle);
        setModalOpen(true);
      } else if (result?.error) {
        console.error("Title generation error:", result.error);
        setProposedProjectTitle(inputValue.slice(0, 50));
        setProposedOrganizationName("");
        setProposedOfficeName(fallbackOfficeName || inputValue.slice(0, 50));
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Error generating titles:", err);
      setProposedProjectTitle(inputValue.slice(0, 50));
      setProposedOrganizationName("");
      setProposedOfficeName(fallbackOfficeName || inputValue.slice(0, 50));
      setModalOpen(true);
    }
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newValue = e.target.value.replace(/\n/g, " ");
    setInputValue(newValue);
  };

  // Focus ring is an outline, not a Tailwind ring: glass-inset owns
  // box-shadow for its inner shadow, and a ring would override it.
  const baseInputClassName =
    "glass-inset border-0 bg-white w-full min-h-[52px] md:min-h-[64px] py-3 md:py-5 px-4 pr-14 md:pr-16 rounded-2xl font-inter text-[15px] text-egray-900 placeholder:text-egray-600 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-700/40 resize-none overflow-hidden content-center";

  return (
    <div id="project-prompt-input" className={className}>
      {label && (
        <p className="mb-3 font-inter text-[13px] leading-[18px] text-egray-700 md:text-[14px]">
          <MessageSquareTextIcon className="mr-1.5 hidden size-4 align-[-3px] text-brand-800 md:inline" />
          <span className="font-medium text-brand-800">{label}</span> or{" "}
          <button
            type="button"
            className="text-egray-700 underline underline-offset-2 hover:text-egray-900"
          >
            choose a template
          </button>
          .
        </p>
      )}

      <form className="relative flex items-center" onSubmit={handleSubmit}>
        {variant === "textarea" ? (
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={(event) => {
              // Single-line intent (newlines are stripped in handleChange), so
              // plain Enter submits like a chat input. Shift+Enter is a no-op
              // rather than a newline; IME composition is left alone.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={placeholder}
            className={cn(
              baseInputClassName,
              "textarea-nowrap leading-snug md:leading-normal",
              inputClassName,
            )}
            rows={1}
            style={{ height: "auto" }}
          />
        ) : (
          <Input
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={cn(baseInputClassName, inputClassName)}
          />
        )}
        <button
          className="btn-primary press absolute right-2 inline-flex size-9 items-center justify-center rounded-xl md:right-3 md:size-10"
          type="submit"
          aria-label="Create project"
        >
          {isMutating || pendingSend ? (
            <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
          ) : (
            <Arrow
              size={18}
              color="currentColor"
              className="h-4 w-4 md:h-5 md:w-5"
            />
          )}
        </button>
      </form>

      {quickStart && (
        <div className="-mx-4 mt-3 md:mx-0">
          <div className="no-scrollbar overflow-x-auto px-4 md:px-0">
            <div className="flex flex-nowrap gap-2 py-1 md:flex-wrap">
              {Object.entries(quickStart).map(([option, optionValue]) => (
                <button
                  type="button"
                  key={option}
                  className="glass press inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 font-inter text-[13px] text-egray-900 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:text-[14px]"
                  onClick={() => setInputValue(optionValue)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
