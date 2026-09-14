import type { ChatHelpers } from "@/hooks/use-chat-compat";
import type { QuickResponse } from "@/lib/ai/tools/generate-quick-responses";
import { ToolInvocationState } from "@/types/ToolInvocationState";
import { Tools } from "@/types/Tools";
import type { ArtifactKind } from "./artifact";
import {
  DocumentArgsType,
  DocumentResultType,
  DocumentToolCall,
  DocumentToolResult,
} from "./document";
import { DocumentPreview } from "./document-preview";
import { QuickResponses } from "./quick-responses";
import { ToolResultDialog } from "./tool-result-dialog";

interface ToolProps {
  state: ToolInvocationState;
  toolName: Tools;
  isReadonly: boolean;
  // Props for QuickResponses (optional, only needed for generateQuickResponses tool)
  setInput?: ChatHelpers["setInput"];
  status?: ChatHelpers["status"];
  isLastMessage?: boolean;
}

interface ToolCallProps extends ToolProps {
  args: Record<string, unknown>;
  result?: never;
}

interface ToolResultProps extends ToolProps {
  args?: never;
  result: Record<string, unknown>;
}

export const Tool = ({
  state,
  toolName,
  args,
  result,
  isReadonly,
  setInput,
  status,
  isLastMessage,
}: ToolCallProps | ToolResultProps) => {
  if (toolName === Tools.createDocument) {
    return (
      <DocumentPreview
        isReadonly={isReadonly}
        args={args as unknown as DocumentArgsType & { kind?: ArtifactKind }}
        result={result as unknown as DocumentResultType}
      />
    );
  }

  if (toolName === Tools.updateDocument) {
    if (!result) {
      return (
        <DocumentToolCall
          type="update"
          args={args as unknown as DocumentArgsType}
          isReadonly={isReadonly}
        />
      );
    }
    return (
      <DocumentToolResult
        type="update"
        result={result as unknown as DocumentResultType}
        isReadonly={isReadonly}
      />
    );
  }

  if (toolName === Tools.requestSuggestions) {
    if (!result) {
      return (
        <DocumentToolCall
          type="request-suggestions"
          args={args as unknown as DocumentArgsType}
          isReadonly={isReadonly}
        />
      );
    }
    return (
      <DocumentToolResult
        type="request-suggestions"
        result={result as unknown as DocumentResultType}
        isReadonly={isReadonly}
      />
    );
  }

  if (toolName === Tools.generateQuickResponses) {
    const qrResult = result as { quickResponses?: QuickResponse[] } | undefined;
    if (qrResult?.quickResponses && setInput && isLastMessage !== undefined) {
      return (
        <QuickResponses
          quickResponses={qrResult.quickResponses}
          setInput={setInput}
          status={status}
          isLastMessage={isLastMessage}
        />
      );
    }
    // Loading state is handled by useStreamingDots in message.tsx
    return null;
  }

  // Research tools are rendered by ResearchStep in message.tsx
  if (
    toolName === Tools.webSearch ||
    toolName === Tools.getContents ||
    toolName === Tools.researchNotes
  ) {
    return null;
  }

  if (state === ToolInvocationState.outputAvailable && result) {
    return <ToolResultDialog toolName={toolName} result={result} />;
  }

  return null;
};
