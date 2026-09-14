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
                    "absolute bottom-2 right-2 rounded-md border border-gray-100 bg-white p-1.5 transition-colors hover:bg-gray-50",
                    promptValidation &&
                      !promptValidation.valid &&
                      "animate-scale-pulse",
                  )}
                  onClick={onEnhance}
                  hidden={isPromptEmpty}
                  disabled={isEnhancing}
                >
                  {isEnhancing ? (
                    <Loader2 className="size-5 animate-spin text-gray-400" />
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
        <p className="text-sm text-red-500">
          {promptValidation.feedback ||
            formatMissingDetails(promptValidation.missing)}
        </p>
      )}
      {form.formState.errors.prompt && (
        <p className="text-sm text-red-500">
          {form.formState.errors.prompt.message}
        </p>
      )}
      {!hasExistingProject && (
        <div className="flex flex-wrap gap-1 pt-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.name}
              type="button"
              className="whitespace-nowrap rounded-[15px] border border-[#eaebee] bg-white px-3 py-1.5 text-sm leading-5 text-[#262626] transition-colors hover:bg-gray-50"
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
