"use client";

import { Loader2, Sparkles } from "lucide-react";

import {
  formatMissingDetails,
  type ValidatePromptResult,
} from "@wildfires-org/turboplan-ai/client";
import {
  BrandGradientIcon,
  cn,
  Label,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import { type DialogForm, PROMPT_SUGGESTIONS } from "./schema";

interface PromptSectionProps {
  form: DialogForm;
  hasExistingProject: boolean;
  isPromptEmpty: boolean;
  isEnhancing: boolean;
  promptValidation: ValidatePromptResult | null;
  onEnhance: () => void;
  onPromptChange: () => void;
}

export function PromptSection({
  form,
  hasExistingProject,
  isPromptEmpty,
  isEnhancing,
  promptValidation,
  onEnhance,
  onPromptChange,
}: PromptSectionProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="prompt">
        {hasExistingProject
          ? "Anything we should know? (optional)"
          : "Project Prompt"}
      </Label>
      <div className="relative">
        <Textarea
          id="prompt"
          placeholder={
            hasExistingProject
              ? "Add any context that might help the AI understand your project (optional)..."
              : "Describe your project including: what you want to do, project location, existing site conditions, and desired outcomes..."
          }
          rows={6}
          {...form.register("prompt", {
            onChange: () => {
              onPromptChange();
            },
          })}
          disabled={form.formState.isSubmitting}
        />
        {/* AI prompt-enhancement is research-oriented — hide it when the
            user is bringing an existing project. */}
        {!hasExistingProject && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "glass press absolute bottom-2 right-2 rounded-lg p-1.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
                    promptValidation &&
                      !promptValidation.valid &&
                      "animate-scale-pulse",
                  )}
                  onClick={onEnhance}
                  hidden={isPromptEmpty}
                  disabled={isEnhancing}
                >
                  {isEnhancing ? (
                    <Loader2 className="size-5 animate-spin text-gray-550" />
                  ) : (
                    <BrandGradientIcon icon={Sparkles} className="size-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Enhance prompt with AI</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {promptValidation && !promptValidation.valid && (
        <p className="text-sm text-error-700">
          {promptValidation.feedback ||
            formatMissingDetails(promptValidation.missing)}
        </p>
      )}
      {form.formState.errors.prompt && (
        <p className="text-sm text-error-700">
          {form.formState.errors.prompt.message}
        </p>
      )}
      {!hasExistingProject && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.name}
              type="button"
              className="glass press whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] leading-5 text-foreground hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-50"
              onClick={() => {
                form.setValue("prompt", suggestion.prompt);
              }}
              disabled={form.formState.isSubmitting}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
