import { Dispatch, Fragment, memo, SetStateAction, useState } from "react";

import { toast } from "sonner";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import { cn } from "@/lib/utils";
import { artifactDefinitions, UIArtifact } from "./artifact";
import { ArtifactActionContext } from "./create-artifact";

interface ArtifactActionsProps {
  artifact: UIArtifact;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: unknown;
  setMetadata: Dispatch<SetStateAction<unknown>>;
  projectId?: string;
}

function PureArtifactActions({
  artifact,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
  projectId,
}: ArtifactActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  // Return null if no artifact definitions exist (all artifacts disabled via feature flags)
  if (!artifactDefinition) {
    return null;
  }

  const actionContext: ArtifactActionContext = {
    title: artifact.title,
    content: artifact.content,
    documentId: artifact.documentId,
    projectId,
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    disabled: isLoading || artifact.status === "streaming",
    mode,
    metadata,
    setMetadata,
  };

  return (
    <div className="flex flex-row gap-1">
      {artifactDefinition.actions.map((action) => {
        // Artifact actions come from a union of per-package definitions; only
        // the app's own `ArtifactAction` carries the optional `render` field.
        const render = (
          action as {
            render?: (ctx: ArtifactActionContext) => React.ReactNode;
          }
        ).render;

        if (render) {
          return (
            <Fragment key={action.description}>
              {render(actionContext)}
            </Fragment>
          );
        }

        return (
          <Tooltip key={action.description}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-fit dark:hover:bg-zinc-700", {
                  "p-2": !action.label,
                  "py-1.5 px-2": action.label,
                })}
                onClick={async () => {
                  setIsLoading(true);

                  try {
                    // Type assertion needed because artifact actions are dynamically matched
                    // by kind at runtime, but TypeScript can't verify metadata type compatibility
                    const onClick = action.onClick as (
                      ctx: ArtifactActionContext,
                    ) => Promise<void> | void;
                    await Promise.resolve(onClick(actionContext));
                  } catch (_error) {
                    toast.error("Failed to execute action");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={
                  isLoading || artifact.status === "streaming"
                    ? true
                    : action.isDisabled
                      ? (
                          action.isDisabled as (
                            ctx: ArtifactActionContext,
                          ) => boolean
                        )(actionContext)
                      : false
                }
              >
                {action.icon as React.ReactNode}
                {action.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.description}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) return false;
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
      return false;
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
    if (prevProps.artifact.content !== nextProps.artifact.content) return false;

    return true;
  },
);
