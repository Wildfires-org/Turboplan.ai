"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";

import type {
  ContextMessageData,
  DocumentsMessageData,
  FieldsMessageData,
  MilestonesMessageData,
  ResearchAgentMessage,
  ResearchAgentMessageTypeValue,
  TimelineMessageData,
} from "../../types";
import { ResearchAgentMessageType } from "../../types";
import {
  type SaveDetails,
  SaveToProjectProvider,
} from "../contexts/save-to-project-context";
import { useResearchAgentMessages } from "../hooks/use-research-agent-messages";
import { useResearchAgentStatus } from "../hooks/use-research-agent-status";
import { CompactProgress } from "./compact-progress";
import { ResearchPanelFooter } from "./research-panel-footer";
import { ContextSection } from "./sections/context-section";
import { DocumentsSection } from "./sections/documents-section";
import { EmptyState } from "./sections/empty-state";
import { FieldsSection } from "./sections/fields-section";
import { MilestonesSection } from "./sections/milestones-section";
import { TimelineSection } from "./sections/timeline-section";

type ResearchPanelProps = {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  isResearchCompleted: boolean;
  onComplete?: () => void;
  onItemsSaved?: (details: SaveDetails) => void;
  /** Whether the current user can trigger research (UPDATE permission). */
  canEdit?: boolean;
};

const RENDERABLE_TYPES = new Set<string>([
  ResearchAgentMessageType.FIELDS,
  ResearchAgentMessageType.MILESTONES,
  ResearchAgentMessageType.DOCUMENTS,
  ResearchAgentMessageType.CONTEXT,
  ResearchAgentMessageType.TIMELINE,
]);

const isTypeEnabled = (type: ResearchAgentMessageTypeValue): boolean => {
  switch (type) {
    case ResearchAgentMessageType.FIELDS:
      return isFieldsPackageEnabled();
    case ResearchAgentMessageType.MILESTONES:
      return isTasksPackageEnabled();
    case ResearchAgentMessageType.DOCUMENTS:
      return isDocumentsPackageEnabled();
    case ResearchAgentMessageType.CONTEXT:
      return true;
    case ResearchAgentMessageType.TIMELINE:
      return isTimelineRecordsPackageEnabled();
    default:
      return false;
  }
};

export const ResearchPanel = ({
  isOpen,
  projectId,
  projectName,
  isResearchCompleted,
  onComplete,
  onItemsSaved,
  canEdit,
}: ResearchPanelProps) => {
  // Always fetch messages so we can detect when content arrives (for auto-open)
  const {
    messages,
    isLoading: isMessagesLoading,
    refresh,
  } = useResearchAgentMessages(projectId, false);
  const { status: agentStatus } = useResearchAgentStatus(projectId);

  const progressMessages = useMemo(() => {
    return messages.filter((m) => m.type === ResearchAgentMessageType.PROGRESS);
  }, [messages]);

  // Build sections in arrival order: track first-seen order per type, keep
  // latest message. The webhook appends each batch into a single message row
  // per type (scoped to the current run), so the latest message of a type
  // already holds every batch — and across runs this correctly shows only the
  // newest run's results.
  const orderedSections = useMemo(() => {
    const typeOrder: ResearchAgentMessageTypeValue[] = [];
    const latestByType = new Map<
      ResearchAgentMessageTypeValue,
      ResearchAgentMessage
    >();

    for (const msg of messages) {
      if (!RENDERABLE_TYPES.has(msg.type)) {
        continue;
      }
      const type = msg.type as ResearchAgentMessageTypeValue;
      if (!latestByType.has(type)) {
        typeOrder.push(type);
      }
      latestByType.set(type, msg);
    }

    return typeOrder
      .filter((type) => isTypeEnabled(type))
      .map((type) => ({ type, message: latestByType.get(type)! }));
  }, [messages]);

  const totalSavedCount = useMemo(() => {
    let count = 0;
    for (const { type, message } of orderedSections) {
      switch (type) {
        case ResearchAgentMessageType.FIELDS:
          count += (message.data as FieldsMessageData).fields.filter(
            (f) => f.saved,
          ).length;
          break;
        case ResearchAgentMessageType.MILESTONES:
          count += (message.data as MilestonesMessageData).milestones.filter(
            (m) => m.saved || m.tasks.some((t) => t.saved),
          ).length;
          break;
        case ResearchAgentMessageType.DOCUMENTS:
          count += (message.data as DocumentsMessageData).documents.filter(
            (d) => d.saved,
          ).length;
          break;
        case ResearchAgentMessageType.CONTEXT:
          count += (message.data as ContextMessageData).context.filter(
            (c) => c.saved,
          ).length;
          break;
        case ResearchAgentMessageType.TIMELINE:
          count += (message.data as TimelineMessageData).timeline.filter(
            (t) => t.saved,
          ).length;
          break;
      }
    }
    return count;
  }, [orderedSections]);

  const isAgentRunning = agentStatus?.hasActiveRun === true;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMessageCountRef = useRef(messages.length);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const threshold = 100;
    setIsNearBottom(
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold,
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isNearBottom) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  if (!isOpen) {
    return null;
  }

  const renderSection = (
    type: ResearchAgentMessageTypeValue,
    message: ResearchAgentMessage,
  ) => {
    switch (type) {
      case ResearchAgentMessageType.FIELDS:
        return (
          <FieldsSection
            messageId={message.id}
            projectId={projectId}
            fields={(message.data as FieldsMessageData).fields}
          />
        );
      case ResearchAgentMessageType.MILESTONES:
        return (
          <MilestonesSection
            messageId={message.id}
            projectId={projectId}
            milestones={(message.data as MilestonesMessageData).milestones}
          />
        );
      case ResearchAgentMessageType.DOCUMENTS:
        return (
          <DocumentsSection
            messageId={message.id}
            projectId={projectId}
            documents={(message.data as DocumentsMessageData).documents}
            onSaved={refresh}
          />
        );
      case ResearchAgentMessageType.CONTEXT:
        return (
          <ContextSection
            messageId={message.id}
            projectId={projectId}
            context={(message.data as ContextMessageData).context}
          />
        );
      case ResearchAgentMessageType.TIMELINE:
        return (
          <TimelineSection
            messageId={message.id}
            projectId={projectId}
            timeline={(message.data as TimelineMessageData).timeline}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SaveToProjectProvider
      onSaved={(details) => {
        refresh();
        onItemsSaved?.(details);
      }}
    >
      <div className="flex h-full flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 p-4"
        >
          {orderedSections.length === 0 ? (
            <EmptyState
              isLoading={isMessagesLoading}
              isAgentRunning={isAgentRunning}
              status={agentStatus}
              progressMessages={progressMessages}
              projectId={projectId}
              canEdit={canEdit}
            />
          ) : (
            <div className="space-y-1.5">
              {orderedSections.map(({ type, message }) => (
                <div key={message.id}>{renderSection(type, message)}</div>
              ))}
            </div>
          )}
        </div>
        {orderedSections.length > 0 && agentStatus && (
          <div className="shrink-0 px-4 pb-2 relative">
            <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <CompactProgress
              status={agentStatus}
              progressMessages={progressMessages}
            />
          </div>
        )}
        <ResearchPanelFooter
          projectId={projectId}
          projectName={projectName}
          isResearchCompleted={isResearchCompleted}
          totalSavedCount={totalSavedCount}
          hasItems={orderedSections.length > 0}
          onComplete={onComplete}
        />
      </div>
    </SaveToProjectProvider>
  );
};
