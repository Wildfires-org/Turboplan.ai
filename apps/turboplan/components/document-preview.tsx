"use client";

import {
  MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import equal from "fast-deep-equal";
import { Flag } from "lucide-react";
import useSWR from "swr";

import type { Document } from "@wildfires-org/turboplan-db/types";
import { TasksPreview } from "@wildfires-org/turboplan-tasks/components";

import { useArtifact } from "@/hooks/use-artifact";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn, fetcher } from "@/lib/utils";
import { ArtifactKind, UIArtifact } from "./artifact";
import {
  DocumentArgsType,
  DocumentResultType,
  DocumentToolCall,
  DocumentToolResult,
} from "./document";
import { InlineDocumentSkeleton } from "./document-skeleton";
import { FileIcon, FullscreenIcon, LoaderIcon } from "./icons";
import { Editor } from "./text-editor";

/** Artifact preview in the chat: glass-card shell, title row, and the
 * document on a white sheet inset in the glass. Loading shares the geometry. */
const PREVIEW_SHELL_CLASS = "glass-card relative w-full rounded-[20px] p-1.5";

const PREVIEW_HEADER_CLASS =
  "flex h-11 flex-row items-center justify-between gap-2 pl-3 pr-12";

const PREVIEW_BODY_CLASS =
  "rounded-[14px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:bg-slate-900";

interface DocumentPreviewProps {
  isReadonly: boolean;
  result?: DocumentResultType;
  args?: DocumentArgsType & { kind?: ArtifactKind };
}

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Array<Document>
  >(result ? `/api/document?id=${result.id}` : null, fetcher);

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((artifact) => ({
        ...artifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (artifact.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          type="create"
          result={{ id: result.id, title: result.title, kind: result.kind }}
          isReadonly={isReadonly}
        />
      );
    }

    if (args) {
      return (
        <DocumentToolCall
          type="create"
          args={{ title: args.title }}
          isReadonly={isReadonly}
        />
      );
    }
  }

  if (isDocumentsFetching) {
    return (
      <LoadingSkeleton
        artifactKind={result?.kind ?? args?.kind ?? artifact.kind}
      />
    );
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : artifact.status === "streaming"
      ? {
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          id: artifact.documentId,
          createdAt: new Date(),
          userId: "noop",
          chatId: null,
        }
      : null;

  if (!document) return <LoadingSkeleton artifactKind={artifact.kind} />;

  return (
    <div className={cn(PREVIEW_SHELL_CLASS, "cursor-pointer")}>
      {result && (
        <HitboxLayer
          hitboxRef={hitboxRef}
          result={result}
          setArtifact={setArtifact}
        />
      )}
      <DocumentHeader
        title={document.title}
        kind={document.kind}
        isStreaming={artifact.status === "streaming"}
      />
      <DocumentContent document={document} />
    </div>
  );
}

const LoadingSkeleton = ({
  artifactKind: _artifactKind,
}: {
  artifactKind: ArtifactKind;
}) => (
  <div className={PREVIEW_SHELL_CLASS} aria-busy="true">
    <div className={PREVIEW_HEADER_CLASS}>
      <div className="flex flex-row items-center gap-3">
        <div className={cn(SKELETON_BAR_CLASS, "size-4")} />
        <div className={cn(SKELETON_BAR_CLASS, "h-3.5 w-24")} />
      </div>
      <div className="p-2 text-gray-550">
        <FullscreenIcon />
      </div>
    </div>
    <div
      className={cn(PREVIEW_BODY_CLASS, "h-[257px] overflow-hidden p-8 pt-4")}
    >
      <InlineDocumentSkeleton />
    </div>
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  result: DocumentResultType;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) =>
        artifact.status === "streaming"
          ? { ...artifact, isVisible: true }
          : {
              ...artifact,
              title: result.title,
              documentId: result.id,
              kind: result.kind,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            },
      );
    },
    [setArtifact, result],
  );

  return (
    <div
      className="absolute left-0 top-0 z-10 size-full rounded-[20px]"
      ref={hitboxRef}
      onClick={handleClick}
      role="presentation"
      aria-hidden="true"
    >
      <div className="w-full p-4 flex justify-end items-center">
        <div className="absolute right-3 top-3 rounded-lg p-2 text-gray-550 hover:bg-white hover:text-foreground dark:hover:bg-white/10">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) return false;
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className={PREVIEW_HEADER_CLASS}>
    <div className="flex min-w-0 flex-row items-center gap-3">
      <div className="shrink-0 text-brand-800">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        ) : kind === "tasks" ? (
          <Flag className="size-4" />
        ) : (
          <FileIcon />
        )}
      </div>
      <div className="truncate text-[14px] font-medium tracking-[-0.01em] text-foreground">
        {title}
      </div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(PREVIEW_BODY_CLASS, {
    "h-[257px] p-4 sm:px-14 sm:py-16 overflow-y-scroll":
      document.kind === "text",
    // Tasks: no fixed height or overflow to allow expand/collapse
  });

  const commonProps = {
    content: document.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => {},
    suggestions: [],
  };

  return (
    <div className={containerClassName}>
      {document.kind === "text" ? (
        <Editor {...commonProps} onSaveContent={() => {}} />
      ) : document.kind === "tasks" ? (
        <TasksPreview content={document.content ?? ""} />
      ) : null}
    </div>
  );
};
