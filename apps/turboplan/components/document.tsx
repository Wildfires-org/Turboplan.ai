import { memo } from "react";

import { toast } from "sonner";

import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind } from "./artifact";
import { FileIcon, LoaderIcon, MessageIcon, PencilEditIcon } from "./icons";

const getActionText = (
  type: "create" | "update" | "request-suggestions",
  tense: "present" | "past",
) => {
  switch (type) {
    case "create":
      return tense === "present" ? "Creating" : "Created";
    case "update":
      return tense === "present" ? "Updating" : "Updated";
    case "request-suggestions":
      return tense === "present"
        ? "Adding suggestions"
        : "Added suggestions to";
    default:
      return null;
  }
};

export interface DocumentResultType {
  id: string;
  title: string;
  kind: ArtifactKind;
}

interface DocumentToolResultProps {
  type: "create" | "update" | "request-suggestions";
  result: DocumentResultType;
  isReadonly: boolean;
}

function PureDocumentToolResult({
  type,
  result,
  isReadonly,
}: DocumentToolResultProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      type="button"
      className="glass press flex w-fit cursor-pointer flex-row items-start gap-3 rounded-xl px-3 py-2 text-[14px] text-foreground hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      onClick={(event) => {
        if (isReadonly) {
          toast.error(
            "Viewing files in shared chats is currently not supported.",
          );
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact({
          documentId: result.id,
          kind: result.kind,
          content: "",
          title: result.title,
          isVisible: true,
          status: "idle",
          boundingBox,
        });
      }}
    >
      <div className="mt-0.5 text-brand-800">
        {type === "create" ? (
          <FileIcon />
        ) : type === "update" ? (
          <PencilEditIcon />
        ) : type === "request-suggestions" ? (
          <MessageIcon />
        ) : null}
      </div>
      <div className="text-left">
        {`${getActionText(type, "past")} "${result.title}"`}
      </div>
    </button>
  );
}

export const DocumentToolResult = memo(PureDocumentToolResult, () => true);

export interface DocumentArgsType {
  title: string;
}

interface DocumentToolCallProps {
  type: "create" | "update" | "request-suggestions";
  args: DocumentArgsType;
  isReadonly: boolean;
}

function PureDocumentToolCall({
  type,
  args,
  isReadonly,
}: DocumentToolCallProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      type="button"
      className="glass press flex w-fit cursor-pointer flex-row items-start justify-between gap-3 rounded-xl px-3 py-2 text-[14px] text-foreground hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      onClick={(event) => {
        if (isReadonly) {
          toast.error(
            "Viewing files in shared chats is currently not supported.",
          );
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: true,
          boundingBox,
        }));
      }}
    >
      <div className="flex flex-row gap-3 items-start">
        <div className="mt-0.5 text-brand-800">
          {type === "create" ? (
            <FileIcon />
          ) : type === "update" ? (
            <PencilEditIcon />
          ) : type === "request-suggestions" ? (
            <MessageIcon />
          ) : null}
        </div>

        <div className="text-left">
          {`${getActionText(type, "present")} ${
            args.title ? `"${args.title}"` : ""
          }`}
        </div>
      </div>

      <div className="mt-0.5 animate-spin text-brand-800">{<LoaderIcon />}</div>
    </button>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
