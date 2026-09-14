"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, MessageSquareTextIcon } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import { cn } from "@wildfires-org/turboplan-utils";

import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { SignupModal } from "@/components/home/signup-modal";
import Arrow from "@/components/icons/arrow";
import { Button } from "@/components/ui/button";
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

  const baseInputClassName =
    "w-full py-3 md:py-5 px-3 md:px-4 pr-12 md:pr-16 rounded-xl md:rounded-2xl border border-green-60 focus:border-green-70 focus-visible:outline-hidden focus-visible:ring-[6px] focus-visible:ring-green-10 focus-visible:ring-offset-[0px] placeholder-gray-500 resize-none overflow-hidden shadow-sm min-h-[46px] md:min-h-[66px] text-sm md:text-[15px] content-center";

  return (
    <div id="project-prompt-input" className={className}>
      {label && (
        <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3">
          <MessageSquareTextIcon className="hidden md:inline w-3 h-3 md:w-4 md:h-4 mr-1 text-green-60" />
          <span className="text-green-60 font-medium">{label}</span> or{" "}
          <button
            type="button"
            className="text-gray-600 underline hover:no-underline"
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
        <Button
          className="absolute right-2 md:right-3 bg-green-60 hover:bg-green-70 text-white rounded-lg h-8 w-8 md:h-10 md:w-10"
          size="icon"
          type="submit"
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
        </Button>
      </form>

      {quickStart && (
        <div className="mt-4 -mx-4 md:mx-0">
          <div className="overflow-x-auto scrollbar-hide px-4 md:px-0">
            <div className="flex flex-nowrap gap-2 pb-2">
              {Object.entries(quickStart).map(([option, optionValue]) => (
                <Button
                  key={option}
                  variant="outline"
                  className="rounded-full text-xs md:text-[15px] font-normal border-lightGray hover:bg-gray-50 px-2.5 md:px-3 py-0 h-7 md:h-8 whitespace-nowrap shrink-0"
                  onClick={() => setInputValue(optionValue)}
                >
                  {option}
                </Button>
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
