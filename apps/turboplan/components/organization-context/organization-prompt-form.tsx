"use client";

import { useEffect, useId } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button, Label, Textarea } from "@wildfires-org/turboplan-utils";
import { ORGANIZATION_PROMPT_MAX_CHARS } from "@wildfires-org/turboplan-workspace/types";

import { useOrganizationContext } from "@/hooks/use-organization-context";
import { EMPTY_STATE_TEXT_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import {
  formatCount,
  getPromptLength,
  type OrganizationPromptFormValues,
  organizationPromptSchema,
  RESEARCH_AGENT_PROMPT_CHARS,
} from "@/lib/organization-context";
import { cn } from "@/lib/utils";
import type { OrganizationContextPrompt } from "@/types/organization-context";

interface OrganizationPromptFormProps {
  organizationId: string;
  /** Owner or editor (organization UPDATE) */
  canEdit: boolean;
  /** The edit permission is still being checked */
  isCheckingPermission?: boolean;
}

interface PromptEditorProps {
  initialPrompt: string;
  isSaving: boolean;
  onSave: (prompt: string) => Promise<OrganizationContextPrompt>;
}

const PROMPT_PLACEHOLDER = [
  "For example:",
  "We are the Shasta County Planning Department, a public agency that reviews land-use and fuel-reduction projects.",
  "Follow CEQA and our 2023 General Plan, and cite the section you rely on.",
  "Write memos with Summary, Background, Analysis and Recommendation headings, in plain English.",
  "Say “parcel”, not “lot”, and “applicant”, not “client”.",
].join("\n");

const TEXTAREA_CLASS = "min-h-[220px] resize-y text-sm leading-6 md:text-sm";

/**
 * The organization's standing AI prompt: an editor for owners and editors,
 * plain text for everyone else.
 */
export const OrganizationPromptForm = ({
  organizationId,
  canEdit,
  isCheckingPermission = false,
}: OrganizationPromptFormProps) => {
  const { prompt, isLoading, error, savePrompt, isSaving } =
    useOrganizationContext(organizationId);

  if (isLoading || isCheckingPermission) {
    return (
      <div role="status" aria-label="Loading the organization prompt">
        <div
          className={cn(SKELETON_BAR_CLASS, "h-[220px] w-full rounded-xl")}
        />
        <div className={cn(SKELETON_BAR_CLASS, "mt-3 h-4 w-64")} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[13px] leading-5 text-error-700">
        Could not load the organization prompt. Reload the page to try again.
      </p>
    );
  }

  if (!canEdit) {
    return <ReadOnlyPrompt prompt={prompt} />;
  }

  return (
    <PromptEditor
      initialPrompt={prompt}
      isSaving={isSaving}
      onSave={savePrompt}
    />
  );
};

const PromptEditor = ({
  initialPrompt,
  isSaving,
  onSave,
}: PromptEditorProps) => {
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const counterId = `${fieldId}-counter`;
  const errorId = `${fieldId}-error`;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isValid },
  } = useForm<OrganizationPromptFormValues>({
    resolver: zodResolver(organizationPromptSchema),
    defaultValues: { prompt: initialPrompt },
    mode: "onChange",
  });

  // The editor can mount on a stale cached prompt and get a newer one from
  // a background revalidation (another editor saved meanwhile). Follow it:
  // an untouched form shows the new prompt, an edit in progress is kept as
  // typed (with its dirty state and errors), and "Discard changes" goes back
  // to the newer prompt. A no-op on mount, when it already matches.
  useEffect(() => {
    reset(
      { prompt: initialPrompt },
      { keepDirtyValues: true, keepDirty: true, keepErrors: true },
    );
  }, [initialPrompt, reset]);

  const value = useWatch({ control, name: "prompt" }) ?? "";
  const length = getPromptLength(value);
  const isOverLimit = length > ORGANIZATION_PROMPT_MAX_CHARS;
  const canSave = isDirty && isValid && !isSaving;

  const describedBy = [helperId, counterId, errors.prompt ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const handleSave = handleSubmit(async ({ prompt }) => {
    try {
      const saved = await onSave(prompt);
      // The API stores the trimmed prompt: show exactly that, as saved.
      reset({ prompt: saved?.prompt ?? prompt });
      toast.success("Organization prompt saved");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : "Could not save the organization prompt",
      );
    }
  });

  const handleDiscard = () => {
    reset();
  };

  return (
    <form onSubmit={handleSave} className="space-y-3" noValidate>
      <Label htmlFor={fieldId} className="sr-only">
        Organization prompt
      </Label>
      <Textarea
        id={fieldId}
        placeholder={PROMPT_PLACEHOLDER}
        aria-describedby={describedBy}
        aria-invalid={isOverLimit || undefined}
        readOnly={isSaving}
        className={cn(
          TEXTAREA_CLASS,
          isOverLimit && "focus-visible:outline-error-700/50",
        )}
        {...register("prompt")}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p id={helperId} className="text-xs leading-5 text-gray-550">
          The first {formatCount(RESEARCH_AGENT_PROMPT_CHARS)} characters are
          also sent to the research agent.
        </p>
        <p
          id={counterId}
          className={cn(
            "shrink-0 text-xs leading-5 tabular-nums",
            isOverLimit ? "font-medium text-error-700" : "text-gray-550",
          )}
        >
          {formatCount(length)} / {formatCount(ORGANIZATION_PROMPT_MAX_CHARS)}
          <span className="sr-only"> characters</span>
        </p>
      </div>

      {errors.prompt && (
        <p
          id={errorId}
          role="alert"
          className="text-xs leading-5 text-error-700"
        >
          {errors.prompt.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {isDirty && (
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={handleDiscard}
            disabled={isSaving}
          >
            Discard changes
          </Button>
        )}
        <Button type="submit" variant="brand" size="sm" disabled={!canSave}>
          {isSaving ? (
            <>
              <Loader2
                aria-hidden
                className="animate-spin motion-reduce:animate-none"
              />
              Saving...
            </>
          ) : (
            "Save prompt"
          )}
        </Button>
      </div>
    </form>
  );
};

const ReadOnlyPrompt = ({ prompt }: { prompt: string }) => {
  if (!prompt) {
    return (
      <p className={EMPTY_STATE_TEXT_CLASS}>
        No prompt yet. Organization owners and editors can add one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="glass-inset whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
        {prompt}
      </div>
      <p className="text-xs leading-5 text-gray-550">
        Only organization owners and editors can change it.
      </p>
    </div>
  );
};
